# ============================================================
# schemas.py
# Data shapes for everything going IN and OUT of the API.
# ============================================================

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ============================================================
# ESP32 INPUT
# ============================================================
class SensorPayload(BaseModel):
    conveyor_id: str
    event: str
    timestamp_ms: Optional[int] = None
    s1_state: bool = False
    s2_state: bool = False
    temperature: Optional[float] = None
    current: Optional[float] = None
    speed_rpm: Optional[float] = None        # was Optional[int] — float fixes Pydantic v2 rejection of 16.42
    target_rpm: Optional[int] = None
    freq_hz: Optional[float] = None
    rpm: Optional[float] = None     
    item_count: int = 0         # RPM read directly from VFD register 0x0014    item_count: int = 0
    motor_on: bool = False
    travel_time_ms: Optional[float] = None
    direction: Optional[str] = None

    class Config:
        extra = "ignore"

    @property
    def speed(self) -> float:
        speed_rpm_val = float(self.speed_rpm) if self.speed_rpm is not None else 0.0
        return min((speed_rpm_val / 68.0) * 100.0, 100.0)

    @property
    def rpm(self) -> float:
        return float(self.speed_rpm) if self.speed_rpm is not None else 0.0

    @property
    def status(self) -> str:
        return "running" if self.motor_on else "stopped"

    @property
    def fault(self) -> str | None:
        return None


# ============================================================
# LIVE DATA OUTPUT — pushed via SSE every tick
# ============================================================
class LiveSensorData(BaseModel):
    conveyor_id: int
    speed: float
    current: float
    temperature: float
    rpm: Optional[float]
    freq_hz: Optional[float]
    rpm: Optional[float]
    object_detected: bool
    status: str
    fault: Optional[str]
    is_running: bool
    items_today: int
    daily_target: int
    runtime_seconds: int
    timestamp: str


# ============================================================
# SENSOR HISTORY OUTPUT
# ============================================================
class SensorReadingOut(BaseModel):
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
# TECH LOG INPUT / OUTPUT
# ============================================================
class TechLogIn(BaseModel):
    conveyor_id: int = 1
    author: str
    intervention_type: str
    description: str


class TechLogOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    conveyor_id: int
    author: str
    intervention_type: str
    description: str


# ============================================================
# ALERT INPUT / OUTPUT
# ============================================================
class AlertIn(BaseModel):
    conveyor_id: int
    message: str
    level: str  # "warning" or "critical"


class AlertOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    timestamp: datetime
    conveyor_id: int
    message: str
    level: str
    resolved: bool
    resolved_at: Optional[datetime]


# ============================================================
# AUTHENTICATION
# ============================================================
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None
    role: str | None = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "operator"


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ============================================================
# PRODUCTION CONFIGURATION
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
    time_to_pass_sec: float
    total_time_required_sec: float
