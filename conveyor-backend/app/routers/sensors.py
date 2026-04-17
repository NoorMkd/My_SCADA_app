# ============================================================
# routers/sensors.py
# All API endpoints the React frontend calls.
#
# Each function here is one "door" React can knock on.
# The router's job is simple:
#   1. Receive the request
#   2. Call the right crud function
#   3. Return the result
#
# No database queries here — that's crud.py's job.
# No business logic here — that's ml_engine.py's job.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.sse_manager import sse_manager
from app.schemas import TechLogIn
from app import crud
from app.ml_engine import generate_report

from app.auth import get_current_user, check_admin_or_supervisor  # Import Security

# APIRouter = a mini FastAPI app we attach to the main app
# prefix="/api" means all routes here start with /api
router = APIRouter(prefix="/api")


# ============================================================
# LIVE STREAM — SSE
# ============================================================

@router.get("/stream")
async def stream_sensor_data():
    """
    GET /api/stream

    React connects here ONCE and keeps the connection open.
    Every 5 seconds when ESP32 sends data, React receives it
    automatically without asking again.

    React usage (we add this to MachineContext.jsx later):
        const source = new EventSource("http://localhost:8000/api/stream")
        source.onmessage = (e) => {
            const data = JSON.parse(e.data)
            // update Conveyor 1 with data
        }

    StreamingResponse = FastAPI keeps the connection open
    media_type="text/event-stream" = the SSE standard format
    """
    return StreamingResponse(
        sse_manager.stream(),
        media_type="text/event-stream",
        headers={
            # Don't cache this — always fresh data
            "Cache-Control": "no-cache",
            # Keep the connection alive
            "Connection": "keep-alive",
            # Important for nginx — don't buffer SSE
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# SENSOR DATA
# ============================================================

@router.get("/conveyor/{conveyor_id}/latest")
async def get_latest(
    conveyor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    GET /api/conveyor/1/latest

    Returns the most recent sensor reading for a conveyor.
    React calls this ONCE on page load to get current state
    before the SSE stream kicks in.

    Depends(get_db) = FastAPI automatically opens a database
    session and passes it here — we don't manage it manually.
    """
    reading = await crud.get_latest_reading(db, conveyor_id)

    if not reading:
        raise HTTPException(
            status_code=404,
            detail=f"No data yet for conveyor {conveyor_id}. Is the ESP32 running?"
        )

    return {
        "conveyor_id":      reading.conveyor_id,
        "timestamp":        reading.timestamp.isoformat(),
        "speed":            reading.speed,
        "current":          reading.current,
        "temperature":      reading.temperature,
        "rpm":              reading.rpm,
        "object_detected":  reading.object_detected,
        "status":           reading.status,
        "fault":            reading.fault,
        "is_running":       reading.status == "running",
    }


@router.get("/history/{conveyor_id}")
async def get_history(
    conveyor_id: int,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    GET /api/history/1
    GET /api/history/1?days=30   ← optional, default is 7

    Returns all sensor readings for the last N days.
    Used by HistoryPage charts (sensor trends).
    """
    readings = await crud.get_history(db, conveyor_id, days)

    return [
        {
            "timestamp":        r.timestamp.isoformat(),
            "speed":            r.speed,
            "current":          r.current,
            "temperature":      r.temperature,
            "rpm":              r.rpm,
            "object_detected":  r.object_detected,
            "status":           r.status,
        }
        for r in readings
    ]


# ============================================================
# ALERTS
# ============================================================

@router.get("/alerts")
async def get_alerts(
    conveyor_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    GET /api/alerts
    GET /api/alerts
    GET /api/alerts?conveyor_id=1   ← optional filter

    Returns all alerts sorted newest first.
    Maps to alertsHistory in your AlertsPage.

    The response shape matches what AlertsPage expects:
      id, conveyor, message, level, resolved, timestamp
    """
    alerts = await crud.get_all_alerts(db, conveyor_id)

    return [
        {
            "id":           a.id,
            "conveyor_id":  a.conveyor_id,
            # React expects "Conveyor 1" format
            "conveyor":     f"Conveyor {a.conveyor_id}",
            "message":      a.message,
            "level":        a.level,
            "resolved":     a.resolved,
            "timestamp":    a.timestamp.isoformat(),
            "resolved_at":  a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(check_admin_or_supervisor)  # Admin/Supervisor only!
):
    """
    PATCH /api/alerts/5/resolve

    Marks one alert as resolved.
    Called when admin/supervisor clicks RESOLVE in AlertsPage.
    """
    alert = await crud.resolve_alert(db, alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Alert {alert_id} not found"
        )

    return {
        "message":   "Alert resolved successfully",
        "alert_id":  alert_id,
    }


# ============================================================
# TECH LOGS
# ============================================================

@router.get("/techlogs")
async def get_techlogs(
    conveyor_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    GET /api/techlogs
    GET /api/techlogs?conveyor_id=1   ← optional filter

    Returns all technician log entries newest first.
    Maps to techLogs in your TechLogPage.

    Response shape matches what TechLogPage expects:
      id, author, conveyor, type, text, timestamp
    """
    logs = await crud.get_all_techlogs(db, conveyor_id)

    return [
        {
            "id":           log.id,
            "author":       log.author,
            "conveyor_id":  log.conveyor_id,
            # React expects "Conveyor 1" format
            "conveyor":     f"Conveyor {log.conveyor_id}",
            # React uses "type" not "intervention_type"
            "type":         log.intervention_type,
            # React uses "text" not "description"
            "text":         log.description,
            "timestamp":    log.timestamp.isoformat(),
        }
        for log in logs
    ]


@router.post("/techlogs", status_code=201)
async def add_techlog(
    entry: TechLogIn,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    POST /api/techlogs

    Saves a new technician log entry.
    Called when technician clicks SUBMIT ENTRY in TechLogPage.

    React sends:
    {
        "conveyor_id": 1,
        "author": "tech_01",
        "intervention_type": "MAINTENANCE",
        "description": "Replaced bearing..."
    }
    """
    log = await crud.create_techlog(db, entry)

    return {
        "id":           log.id,
        "author":       log.author,
        "conveyor_id":  log.conveyor_id,
        "conveyor":     f"Conveyor {log.conveyor_id}",
        "type":         log.intervention_type,
        "text":         log.description,
        "timestamp":    log.timestamp.isoformat(),
    }


# ============================================================
# ML REPORT
# ============================================================

@router.get("/ml/report/{conveyor_id}")
async def get_ml_report(
    conveyor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)  # Requires Login
):
    """
    GET /api/ml/report/1

    Generates an ML analysis report for one conveyor.
    Called by HistoryPage when user opens it or clicks refresh.

    Fetches 30 days of sensor data + full maintenance +
    full alerts history → passes to ml_engine → returns report.

    Response shape matches AI_DATA in HistoryPage.jsx exactly.
    """
    data = await crud.get_data_for_ml(db, conveyor_id)

    report = await generate_report(
        conveyor_id=conveyor_id,
        sensors=data["sensors"],
        maintenance=data["maintenance"],
        alerts=data["alerts"],
    )

    return report