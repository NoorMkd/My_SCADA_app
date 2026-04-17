# ============================================================
# crud.py
# Every database query in the entire project lives here.
#
# Rules:
#   - Routers call these functions → they never write SQL
#   - Each function does ONE thing only
#   - All functions are async (non-blocking)
#
# "db: AsyncSession" = the database connection passed in
# from the router via Depends(get_db)
# ============================================================

from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SensorReading, MaintenanceIntervention, FaultAlert, User
from app.schemas import TechLogIn, UserCreate
from app.auth import get_password_hash


# ============================================================
# SENSOR READINGS
# ============================================================

async def save_sensor_reading(db: AsyncSession, data: dict) -> SensorReading:
    """
    Saves one ESP32 message to the database.
    Called by mqtt_handler.py every 5 seconds.
    """
    reading = SensorReading(
        conveyor_id=data["conveyor_id"],
        speed=data["speed"],
        current=data["current"],
        temperature=data["temperature"],
        rpm=data.get("rpm"),
        object_detected=data["object_detected"],
        status=data["status"],
        fault=data.get("fault"),
    )
    db.add(reading)
    await db.commit()
    await db.refresh(reading)
    return reading


async def get_latest_reading(
    db: AsyncSession,
    conveyor_id: int
) -> SensorReading | None:
    """
    Returns the single most recent reading for a conveyor.
    Called by React on page load (before SSE kicks in).
    """
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.conveyor_id == conveyor_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_history(
    db: AsyncSession,
    conveyor_id: int,
    days: int = 7,
) -> list[SensorReading]:
    """
    Returns all readings for the last N days.
    Used by HistoryPage charts.

    Note: ESP32 sends every 5 seconds.
    So 7 days = 7 × 24 × 3600 / 5 = ~120,960 rows.
    TimescaleDB handles this easily.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(SensorReading)
        .where(
            and_(
                SensorReading.conveyor_id == conveyor_id,
                SensorReading.timestamp >= since,
            )
        )
        .order_by(SensorReading.timestamp.asc())
    )
    return list(result.scalars().all())


async def count_items_today(
    db: AsyncSession,
    conveyor_id: int,
) -> int:
    """
    Counts how many times object_detected=True today.
    This becomes itemsToday in your React MachineContext.

    Logic: ESP32 sends object_detected=True every time
    a package passes the sensor → count = items detected.
    """
    today = datetime.now(timezone.utc).date()

    result = await db.execute(
        select(func.count())
        .where(
            and_(
                SensorReading.conveyor_id == conveyor_id,
                SensorReading.object_detected == True,
                func.date(SensorReading.timestamp) == today,
            )
        )
    )
    return result.scalar() or 0


async def count_runtime_seconds(
    db: AsyncSession,
    conveyor_id: int,
) -> int:
    """
    Counts how many seconds the conveyor ran today.
    Logic: each reading with status="running" = 5 seconds
    (because ESP32 sends every 5 seconds).
    So we count rows × 5.
    """
    today = datetime.now(timezone.utc).date()

    result = await db.execute(
        select(func.count())
        .where(
            and_(
                SensorReading.conveyor_id == conveyor_id,
                SensorReading.status == "running",
                func.date(SensorReading.timestamp) == today,
            )
        )
    )
    # Multiply by 5 because each reading = 5 seconds
    return (result.scalar() or 0) * 5


# ============================================================
# ALERTS
# ============================================================

async def create_alert(
    db: AsyncSession,
    conveyor_id: int,
    message: str,
    level: str,
) -> FaultAlert:
    """
    Creates a new alert in the database.
    Called automatically by mqtt_handler when:
      - ESP32 sends a fault
      - Temperature crosses a threshold
      - Current crosses a threshold
    """
    alert = FaultAlert(
        conveyor_id=conveyor_id,
        message=message,
        level=level,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_all_alerts(
    db: AsyncSession,
    conveyor_id: int | None = None,
) -> list[FaultAlert]:
    """
    Returns all alerts sorted newest first.
    Maps to alertsHistory in your AlertsPage.
    Optional filter by conveyor_id.
    """
    query = (
        select(FaultAlert)
        .order_by(FaultAlert.timestamp.desc())
    )

    if conveyor_id is not None:
        query = query.where(FaultAlert.conveyor_id == conveyor_id)

    result = await db.execute(query)
    return list(result.scalars().all())


async def resolve_alert(
    db: AsyncSession,
    alert_id: int,
) -> FaultAlert | None:
    """
    Marks one alert as resolved.
    Called when admin/supervisor clicks RESOLVE in AlertsPage.
    """
    result = await db.execute(
        select(FaultAlert).where(FaultAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()

    if alert:
        alert.resolved = True
        alert.resolved_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(alert)

    return alert


# ============================================================
# TECH LOGS
# ============================================================

async def get_all_techlogs(
    db: AsyncSession,
    conveyor_id: int | None = None,
) -> list[MaintenanceIntervention]:
    """
    Returns all technician log entries newest first.
    Maps to techLogs in your TechLogPage.
    """
    query = (
        select(MaintenanceIntervention)
        .order_by(MaintenanceIntervention.timestamp.desc())
    )

    if conveyor_id is not None:
        query = query.where(
            MaintenanceIntervention.conveyor_id == conveyor_id
        )

    result = await db.execute(query)
    return list(result.scalars().all())


async def create_techlog(
    db: AsyncSession,
    entry: TechLogIn,
) -> MaintenanceIntervention:
    """
    Saves a new technician log entry.
    Called when technician clicks SUBMIT ENTRY in TechLogPage.
    """
    log = MaintenanceIntervention(
        conveyor_id=entry.conveyor_id,
        author=entry.author,
        intervention_type=entry.intervention_type,
        description=entry.description,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# ============================================================
# ML ENGINE DATA FETCH
# ============================================================

async def get_data_for_ml(
    db: AsyncSession,
    conveyor_id: int,
) -> dict:
    """
    Fetches everything the ML engine needs in one call.
    Returns last 30 days of sensor data + full history
    of maintenance logs and alerts.

    Called by the ML report endpoint.
    """
    since_30_days = datetime.now(timezone.utc) - timedelta(days=30)

    # Last 30 days of sensor readings
    sensor_result = await db.execute(
        select(SensorReading)
        .where(
            and_(
                SensorReading.conveyor_id == conveyor_id,
                SensorReading.timestamp >= since_30_days,
            )
        )
        .order_by(SensorReading.timestamp.asc())
    )
    sensors = list(sensor_result.scalars().all())

    # Full maintenance history (no time limit)
    maintenance_result = await db.execute(
        select(MaintenanceIntervention)
        .where(MaintenanceIntervention.conveyor_id == conveyor_id)
        .order_by(MaintenanceIntervention.timestamp.desc())
    )
    maintenance = list(maintenance_result.scalars().all())

    # Full alerts history (no time limit)
    alerts_result = await db.execute(
        select(FaultAlert)
        .where(FaultAlert.conveyor_id == conveyor_id)
        .order_by(FaultAlert.timestamp.desc())
    )
    alerts = list(alerts_result.scalars().all())

    return {
        "sensors": sensors,
        "maintenance": maintenance,
        "alerts": alerts,
    }


# ============================================================
# PHASE 2: USER AUTHENTICATION QUERIES
# ============================================================

async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """
    Finds a user by their exact username.
    Returns None if the user does not exist.
    """
    result = await db.execute(
        select(User).where(User.username == username)
    )
    return result.scalars().first()


async def count_users(db: AsyncSession) -> int:
    """
    Returns the total number of users in the system.
    Useful to know if the first user is registering.
    """
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar() or 0


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """
    Finds a user by their email address.
    """
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalars().first()


async def get_all_users(db: AsyncSession) -> list[User]:
    """
    Fetches all registered users from the database.
    Used by the Admin dashboard for the Users list.
    """
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """
    Takes an incoming raw password, hashes it using bcrypt,
    and saves the new secure User record in PostgreSQL.
    """
    hashed_pass = get_password_hash(user_data.password)
    
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_pass,
        role=user_data.role,
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """
    Deletes a user from the database.
    Used by the Admin dashboard.
    """
    # Find the user first
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        return False
        
    # Delete the user and commit
    await db.delete(user)
    await db.commit()
    return True
