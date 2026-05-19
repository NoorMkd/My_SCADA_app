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
import time

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

    # Step 1: Create database tables
    # init_db() reads our models.py and creates all 3 tables
    # in PostgreSQL if they don't exist yet.
    # Also sets up the TimescaleDB hypertable.
    print("[APP] Initializing database...")
    await init_db()

    # Step 2: Give mqtt_handler what it needs
    # mqtt_handler runs in a thread but needs to:
    #   - submit async work to the event loop
    #   - broadcast data via sse_manager
    #   - open database sessions via AsyncSessionLocal
    print("[APP] Initializing MQTT handler...")
    loop = asyncio.get_event_loop()
    init_mqtt_handler(
        loop=loop,
        sse_manager=sse_manager,
        session_factory=AsyncSessionLocal,
    )

    # Step 3: Start the MQTT listener in a background thread
    # This connects to Mosquitto and starts listening
    # for ESP32 messages on topic: motors/conveyor_1/sensors
    print("[APP] Starting MQTT listener...")
    start_mqtt()

    print("=" * 55)
    print("  Backend is ready!")
    print("  API docs: http://localhost:8000/docs")
    print("  Live stream: http://localhost:8000/api/stream")
    print("=" * 55)

    yield  # ← app runs here, serving all requests

    # ── SHUTDOWN ──────────────────────────────────────────
    # The MQTT thread is a daemon → stops automatically
    # when the app process ends. Nothing extra needed.
    print("[APP] Shutting down...")


# ============================================================
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