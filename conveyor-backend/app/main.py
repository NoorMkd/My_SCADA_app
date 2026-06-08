# ============================================================
# main.py
# The entry point of the entire backend.
# Run with: uvicorn app.main:app --reload
#
# This file does 5 things:
#   1. Creates the FastAPI app
#   2. On startup → connects to database, creates tables
#   3. On startup → starts the MQTT listener
#   4. Adds CORS middleware (lets React talk to this server)
#   5. Registers all API routes from routers/sensors.py
# ============================================================

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, AsyncSessionLocal
from app.routers import sensors, auth, production
from app.sse_manager import sse_manager
from app.mqtt_handler import init_mqtt_handler, start_mqtt
from fastapi.responses import StreamingResponse
import asyncio
from app.routers import sensors, auth, production, predictions
import time
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, func as sqlfunc
from datetime import datetime, timezone, timedelta
from app.models import SensorReading, MaintenanceIntervention, MLPrediction, ProductionConfig
from app import ml_engine

from app.email_alerts import check_and_send_alerts



# ============================================================
# DAILY ML JOB
# Runs every day, fetches today's sensor data,
# runs all 5 predictions, saves results to database.
# ============================================================

async def run_daily_predictions():
    
    print("[ML] Running daily predictions...")

    async with AsyncSessionLocal() as db:
        try:
            # ── get today's time range ────────────────────
            now   = datetime.now(timezone.utc)
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # ── fetch today's sensor readings ─────────────
            result = await db.execute(
                select(SensorReading).where(
                    SensorReading.timestamp >= today,
                    SensorReading.conveyor_id == 1
                )
            )
            readings = result.scalars().all()

            if not readings:
                print("[ML] No sensor data for today — skipping.")
                return

            # ── compute averages ──────────────────────────
            belt_speeds  = [r.belt_speed_mps for r in readings if r.belt_speed_mps]
            temperatures = [r.temperature    for r in readings]
            currents     = [r.current        for r in readings]
            items_count  = sum(1 for r in readings if r.object_detected)

            avg_belt_speed  = sum(belt_speeds)  / len(belt_speeds)  if belt_speeds  else 0.6
            avg_temperature = sum(temperatures) / len(temperatures) if temperatures else 55.0
            avg_current     = sum(currents)     / len(currents)     if currents     else 2.2

            # ── expected speed from average vfd reading ───
            avg_speed_val   = sum(r.speed for r in readings) / len(readings)
            expected_speed  = (avg_speed_val / 50) * 0.8
            speed_deviation = round(avg_belt_speed - expected_speed, 3)

            # ── maintenance history ───────────────────────
            thirty_days_ago = now - timedelta(days=30)

            maint_result = await db.execute(
                select(MaintenanceIntervention).where(
                    MaintenanceIntervention.conveyor_id == 1,
                    MaintenanceIntervention.timestamp >= thirty_days_ago
                )
            )
            recent_maint = maint_result.scalars().all()
            interventions_30d = len(recent_maint)

            # days since last maintenance
            all_maint = await db.execute(
                select(MaintenanceIntervention).where(
                    MaintenanceIntervention.conveyor_id == 1
                ).order_by(MaintenanceIntervention.timestamp.desc()).limit(1)
            )
            last_maint = all_maint.scalars().first()
            if last_maint:
                ts = last_maint.timestamp
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                days_since_maint = (now - ts).days
            else:
                days_since_maint = 0

            # ── theoretical max from production config ────
            config_result = await db.execute(
                select(ProductionConfig).limit(1)
            )
            config = config_result.scalars().first()
            theoretical_max = config.todays_target if config else 50

            # ── run the 5 functions ───────────────────────
            anomaly    = ml_engine.predict_anomaly(
                            avg_belt_speed, speed_deviation,
                            avg_temperature, avg_current, items_count)

            rul        = ml_engine.predict_rul(
                            avg_belt_speed, speed_deviation,
                            avg_temperature, avg_current,
                            days_since_maint, interventions_30d)

            alert      = ml_engine.predict_alert(
                            avg_belt_speed, speed_deviation,
                            avg_temperature, avg_current, items_count,
                            days_since_maint, interventions_30d)

            oee        = ml_engine.calculate_oee(items_count, theoretical_max)
            maintenance = ml_engine.calculate_maintenance_due(days_since_maint)

            # ── send email alerts if needed ───────────────────────
            check_and_send_alerts(anomaly, rul, alert)

            # ── save to database ──────────────────────────
            prediction = MLPrediction(
                conveyor_id             = 1,
                anomaly_score           = anomaly["score"],
                anomaly_label           = anomaly["label"],
                anomaly_explanation     = anomaly["explanation"],
                rul_days                = rul["days"],
                rul_label               = rul["label"],
                rul_explanation         = rul["explanation"],
                alert_label             = alert["label"],
                alert_count             = alert["count"],
                alert_recommendation    = alert["recommendation"],
                oee_score               = oee["score"],
                oee_items_today         = oee["items_today"],
                oee_theoretical_max     = oee["theoretical_max"],
                oee_items_lost          = oee["items_lost"],
                oee_explanation         = oee["explanation"],
                maintenance_score       = maintenance["score"],
                maintenance_days_since  = maintenance["days_since_last"],
                maintenance_recommendation = maintenance["recommendation"],
            )

            db.add(prediction)
            await db.commit()

            print(f"[ML] Predictions saved ✓ — "
                  f"Anomaly: {anomaly['label']}, "
                  f"RUL: {rul['days']} days, "
                  f"Alert: {alert['label']}")
                  
            # ── Push prediction to React via SSE ──────────────
            from app.sse_manager import sse_manager
            await sse_manager.broadcast({
                "type": "prediction",
                "conveyor_id": 1,
                "prediction": {
                    "anomaly": anomaly,
                    "rul": rul,
                    "alert": alert,
                    "oee": oee,
                    "maintenance": maintenance
                }
            })

        except Exception as e:
            print(f"[ML] Error during predictions: {e}")

 # ============================================================
# LIFESPAN
# Code that runs at startup and shutdown.
#
# Everything BEFORE yield → runs when app starts
# Everything AFTER yield  → runs when app stops
#
# This replaces the old @app.on_event("startup") pattern
# which is now deprecated in modern FastAPI.
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # ── STARTUP ───────────────────────────────────────────
    print("=" * 55)
    print("  Conveyor SCADA backend starting...")
    print("=" * 55)
    print("[APP] Initializing database...")
    await init_db()
    print("[APP] Initializing MQTT handler...")
    loop = asyncio.get_event_loop()
    init_mqtt_handler(
        loop=loop,
        sse_manager=sse_manager,
        session_factory=AsyncSessionLocal,
    )

    print("[APP] Starting MQTT listener...")
    start_mqtt()

    # ── START APSCHEDULER ─────────────────────────────────
    scheduler = AsyncIOScheduler()

    # runs every day at 08:00 AM
    # scheduler.add_job(
    #     run_daily_predictions,
    #     trigger="cron",
    #     hour=8,
    #     minute=0,
    #     id="daily_ml_predictions"
    # )

    scheduler.add_job(
         run_daily_predictions,
         trigger="interval",
         minutes=5,
         id="daily_ml_predictions"
   )


    # also run once immediately at startup so we can test it
    scheduler.add_job(
        run_daily_predictions,
        trigger="date",
        run_date=datetime.now(timezone.utc),
        id="startup_ml_predictions"
    )

    scheduler.start()
    print("[ML] APScheduler started ✓ — predictions run daily at 08:00")

    print("=" * 55)
    print("  Backend is ready!")
    print("  API docs: http://localhost:8000/docs")
    print("=" * 55)

    yield

    # ── SHUTDOWN ──────────────────────────────────────────
    scheduler.shutdown()
    print("[APP] Shutting down...")

# CREATE THE APP
# ============================================================

app = FastAPI(
    title="Conveyor SCADA API",
    description="Real-time conveyor monitoring — PFE project",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# CORS MIDDLEWARE
# CORS = Cross-Origin Resource Sharing
#
# Without this the browser BLOCKS React from calling our API.
# Why? Because React runs on localhost:5173 and the API runs
# on localhost:8000 — different ports = different "origins".
# The browser treats this as a security risk and blocks it.
#
# This middleware tells the browser: "it's okay, we allow it"
# ============================================================

app.add_middleware(
    CORSMiddleware,

    # Which React addresses are allowed to call us (allow any in local net)
    allow_origins=["*"],

    allow_credentials=True,
    allow_methods=["*"],    # GET, POST, PATCH, DELETE, OPTIONS
    allow_headers=["*"],    # all headers allowed
)


# ============================================================
# REGISTER ROUTES
# ============================================================

# All API endpoints from routers/sensors.py
# prefix="/api" is already set inside sensors.py
# so routes are: /api/stream, /api/alerts, etc.
app.include_router(sensors.router)

# All Authentication routes (login, register)
app.include_router(auth.router)

# Production Configuration routes
app.include_router(production.router)

app.include_router(predictions.router)
# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    """
    GET http://localhost:8000/

    Quick check that the server is running.
    Open this in your browser to verify.
    """
    return {
        "status":  "running",
        "message": "Conveyor SCADA API is online",
        "docs":    "http://localhost:8000/docs",
        "stream":  "http://localhost:8000/api/stream",
    }
# Store the latest frame per conveyor in memory
# { conveyor_id: jpeg_bytes }
latest_frames = {}

# ── ENDPOINT 1: ESP32-CAM posts frames here ──
@app.post("/api/stream/frame")
async def receive_frame(request: Request):
    # Read the JPEG bytes from the request body
    frame_bytes = await request.body()
    conveyor_id = request.headers.get("X-Conveyor-ID", "1")

    # Store it — overwrites the previous frame
    latest_frames[conveyor_id] = frame_bytes

    return {"status": "ok"}


# ── ENDPOINT 2: Frontend reads the MJPEG stream here ──
@app.get("/api/stream/{conveyor_id}")
async def video_stream(conveyor_id: str):

    async def generate():
        # Keep sending frames forever (until browser disconnects)
        while True:
            frame = latest_frames.get(conveyor_id)

            if frame:
                # MJPEG format — each frame is wrapped like this
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame +
                    b"\r\n"
                )

            # Wait for next frame
            await asyncio.sleep(0.04)  # ~25 FPS

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── ENDPOINT 3: Check if camera is online ──
@app.get("/api/stream/{conveyor_id}/status")
async def stream_status(conveyor_id: str):
    has_frame = conveyor_id in latest_frames
    return {
        "online": has_frame,
        "conveyor_id": conveyor_id
    }