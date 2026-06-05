# models.py
# Defines every table in the database.
# Each class = one table, each variable = one column.

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# ============================================================
# TABLE 1: sensor_readings
# ============================================================
class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        primary_key=True,
        index=True,
    )

    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)

    # VFD output frequency in Hz (0–50 Hz), used as the speed value
    speed: Mapped[float] = mapped_column(Float, default=0.0)

    # Current in Amperes (0–2.5 A for this motor)
    current: Mapped[float] = mapped_column(Float, default=0.0)

    # Temperature in Celsius from MAX6675 thermocouple
    temperature: Mapped[float] = mapped_column(Float, default=0.0)

    # Actual belt speed in m/s derived from S1→S2 travel time — null when no item has passed recently
    belt_speed_mps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Motor shaft speed in RPM (or m/min from ESP32 travel-time — mislabelled in firmware)
    rpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # True when sensor 1 detected an object (drives items_today counter)
    object_detected: Mapped[bool] = mapped_column(Boolean, default=False)

    # "running" or "stopped" — server-tracked motor state
    status: Mapped[str] = mapped_column(String(50), default="unknown")

    # Fault message from ESP32 — None means no fault
    fault: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
# ============================================================
# TABLE 2: maintenance_interventions
# ============================================================
class MaintenanceIntervention(Base):
    __tablename__ = "maintenance_interventions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)
    author: Mapped[str] = mapped_column(String(100))
    intervention_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)


# ============================================================
# TABLE 3: faults_alerts
# ============================================================
class FaultAlert(Base):
    __tablename__ = "faults_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)
    message: Mapped[str] = mapped_column(String(500))
    level: Mapped[str] = mapped_column(String(20))
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ============================================================
# TABLE 4: users
# ============================================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="operator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ============================================================
# TABLE 5: production_config
# ============================================================
class ProductionConfig(Base):
    __tablename__ = "production_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    todays_target: Mapped[int] = mapped_column(Integer, default=1000)
    material_name: Mapped[str] = mapped_column(String(100), default="Standard Box")
    material_type: Mapped[str] = mapped_column(String(50), default="Cardboard")
    item_length_cm: Mapped[float] = mapped_column(Float, default=10.0)
    item_mass_kg: Mapped[float] = mapped_column(Float, default=1.0)
    conveyor_speed_m_s: Mapped[float] = mapped_column(Float, default=0.5)
    conveyor_length_m: Mapped[float] = mapped_column(Float, default=5.0)

    @property
    def time_to_pass_sec(self) -> float:
        if self.conveyor_speed_m_s and self.conveyor_speed_m_s > 0:
            return (self.item_length_cm / 100.0) / self.conveyor_speed_m_s
        return 0.0

    @property
    def total_time_required_sec(self) -> float:
        if not self.conveyor_speed_m_s or self.conveyor_speed_m_s <= 0:
            return 0.0
        transit_time = self.conveyor_length_m / self.conveyor_speed_m_s
        return (self.time_to_pass_sec * (self.todays_target or 0)) + transit_time

# ============================================================
# TABLE 6: ml_predictions
# ============================================================
class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)

    # Model 1 — Anomaly
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_label: Mapped[str] = mapped_column(String(50), default="NORMAL")
    anomaly_explanation: Mapped[str] = mapped_column(Text, nullable=True)

    # Model 2 — RUL
    rul_days: Mapped[float] = mapped_column(Float, default=0.0)
    rul_label: Mapped[str] = mapped_column(String(50), default="HEALTHY")
    rul_explanation: Mapped[str] = mapped_column(Text, nullable=True)

    # Model 3 — Alert Forecast
    alert_label: Mapped[str] = mapped_column(String(50), default="LOW")
    alert_count: Mapped[int] = mapped_column(Integer, default=0)
    alert_recommendation: Mapped[str] = mapped_column(Text, nullable=True)

    # KPI 1 — OEE
    oee_score: Mapped[float] = mapped_column(Float, default=0.0)
    oee_items_today: Mapped[int] = mapped_column(Integer, default=0)
    oee_theoretical_max: Mapped[int] = mapped_column(Integer, default=0)
    oee_items_lost: Mapped[int] = mapped_column(Integer, default=0)
    oee_explanation: Mapped[str] = mapped_column(Text, nullable=True)

    # KPI 2 — Maintenance Due
    maintenance_score: Mapped[float] = mapped_column(Float, default=0.0)
    maintenance_days_since: Mapped[int] = mapped_column(Integer, default=0)
    maintenance_recommendation: Mapped[str] = mapped_column(Text, nullable=True)