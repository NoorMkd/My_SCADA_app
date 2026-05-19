# ============================================================
# schemas.py
# Data shapes for everything going IN and OUT of the API.
#
# Think of each class as a "contract":
#   - Input schemas  → what we ACCEPT (validated automatically)
#   - Output schemas → what we RETURN (consistent shape always)
#
# "Mapped" means: this schema can be built directly from a
# SQLAlchemy model object (from our database query results)
# ============================================================

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


# ============================================================
# ESP32 INPUT
# The exact JSON shape the ESP32 publishes via MQTT
# If any field is missing or wrong type → rejected automatically
# ============================================================
class SensorPayload(BaseModel):
    conveyor_id: str
    event: str
    timestamp_ms: Optional[int] = None
    s1_state: bool = False
    s2_state: bool = False
    temperature: Optional[float] = None
    current: Optional[float] = None
    speed_rpm: Optional[int] = None
    target_rpm: Optional[int] = None
    freq_hz: Optional[float] = None
    item_count: int = 0
    motor_on: bool = False
    travel_time_ms: Optional[float] = None
    direction: Optional[str] = None

    class Config:
        extra = "ignore"   # tolerate extra fields without failing
        
    @property
    def speed(self) -> float:
        # Convert RPM to a 0-100% speed assuming max 68.0 RPM based on ESP32 main.cpp
        rpm = float(self.speed_rpm)
        return min((rpm / 68.0) * 100.0, 100.0)

    @property
    def rpm(self) -> float:
        return float(self.speed_rpm)

    @property
    def status(self) -> str:
        return "running" if self.motor_on else "stopped"

    @property
    def fault(self) -> str | None:
        return None


# ============================================================
# LIVE DATA OUTPUT
# Pushed to React every 5 seconds via SSE
# React's MachineContext reads this and updates Conveyor 1
# ============================================================
class LiveSensorData(BaseModel):
    """
    The live snapshot React receives via SSE.
    Maps directly to your MachineContext conveyor object.
    """
    conveyor_id: int

    # Raw sensor values
    speed: float
    current: float
    temperature: float
    rpm: Optional[float]
    object_detected: bool
    status: str
    fault: Optional[str]

    # Derived values (calculated by the backend)
    is_running: bool        # True if status == "running"
    items_today: int        # count of object_detected=True today
    daily_target: int       # pushed live from db config
    runtime_seconds: int    # seconds of status="running" today

    timestamp: str


# ============================================================
# SENSOR HISTORY OUTPUT
# Returned by GET /api/history/{conveyor_id}
# Used by HistoryPage charts
# ============================================================
class SensorReadingOut(BaseModel):
    """One historical reading returned to React"""

    # model_config tells Pydantic: you can build this from
    # a SQLAlchemy object directly (not just from a dict)
    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    conveyor_id: int
    speed: float
    current: float
    temperature: float
    rpm: Optional[float]
    object_detected: bool
    status: str
    fault: Optional[str]


# ============================================================
# TECH LOG INPUT
# What React sends when technician submits a log entry
# ============================================================
class TechLogIn(BaseModel):
    """Received from TechLogPage form submission"""
    conveyor_id: int = 1
    author: str
    intervention_type: str    # "MAINTENANCE" | "INSPECTION" | "REPAIR"
    description: str


# ============================================================
# TECH LOG OUTPUT
# What the API returns after saving a log entry
# ============================================================
class TechLogOut(BaseModel):
    """Returned to React after saving a tech log"""
    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    conveyor_id: int
    author: str
    intervention_type: str
    description: str


# ============================================================
# ALERT OUTPUT
# What the API returns to AlertsPage
# ============================================================
class AlertOut(BaseModel):
    """One alert returned to React's AlertsPage"""
    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    conveyor_id: int
    message: str
    level: str                      # "warning" or "critical"
    resolved: bool
    resolved_at: Optional[datetime]


# ============================================================
# PHASE 2: AUTHENTICATION SCHEMAS
# ============================================================
class Token(BaseModel):
    """The JSON Web Token returned upon successful login"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """The decoded payload inside the JWT"""
    username: str | None = None
    role: str | None = None


class UserCreate(BaseModel):
    """Incoming user payload (mostly for admins creating users)"""
    username: str
    email: str
    password: str
    role: str = "operator"  # "admin", "supervisor", "operator", "technician"


class UserResponse(BaseModel):
    """
    Outgoing user data. 
    Crucial: password is NOT included here!
    """
    model_config = {"from_attributes": True}

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ============================================================
# PRODUCTION CONFIGURATION SCHEMAS
# ============================================================
class ProductionConfigBase(BaseModel):
    todays_target: int
    material_name: str
    material_type: str
    item_length_cm: float
    item_mass_kg: float
    conveyor_speed_m_s: float
    conveyor_length_m: float

class ProductionConfigIn(ProductionConfigBase):
    pass

class ProductionConfigOut(ProductionConfigBase):
    model_config = {"from_attributes": True}

    id: int
    updated_at: datetime
    # We include the computation from the model property
    time_to_pass_sec: float
    total_time_required_sec: float
