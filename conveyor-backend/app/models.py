 
# ***This file defines the database tables. In Python, instead of writing SQL 
# like CREATE TABLE sensor_readings (...),
#  we write Python classes and SQLAlchemy converts them to real database tables automatically.****


# models.py
# Defines every table in the database.
#
# Each class = one table.
# Each variable inside the class = one column in that table.
#
# We have 3 tables:
#   1. sensor_readings         → every ESP32 message (1 per second)
#   2. maintenance_interventions → technician log entries (TechLogPage)
#   3. faults_alerts           → all alerts (AlertsPage)
# ============================================================

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# DeclarativeBase = the parent class all our tables inherit from
# Think of it as the template every table is built from
class Base(DeclarativeBase):
    pass


# ============================================================
# TABLE 1: sensor_readings
# One row = one message from the ESP32 = one second of data
# This becomes a TimescaleDB hypertable (very fast time queries)
# ============================================================
class SensorReading(Base):
    __tablename__ = "sensor_readings"

    # Primary key — a unique number that auto-increases for every new row
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # When this reading was recorded
    # server_default=func.now() means: PostgreSQL sets this automatically
    # index=True means: make queries on timestamp much faster
    # primary_key=True is required by TimescaleDB when using a hypertable
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        primary_key=True,
        index=True,
    )

    # Which conveyor sent this data (always 1 for our project)
    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)

    # ── Sensor values from ESP32 ──────────────────────────────
    # speed: treated as percentage 0–100
    speed: Mapped[float] = mapped_column(Float, default=0.0)

    # current in Amperes
    current: Mapped[float] = mapped_column(Float, default=0.0)

    # temperature in Celsius
    temperature: Mapped[float] = mapped_column(Float, default=0.0)

    # RPM of the motor (Optional = can be None if ESP32 doesn't send it)
    rpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # True if the sensor detected an object passing (counts items today)
    object_detected: Mapped[bool] = mapped_column(Boolean, default=False)

    # "running" or "stopped" — tells us if the machine is on
    status: Mapped[str] = mapped_column(String(50), default="unknown")

    # Fault message from ESP32 — None means no fault
    fault: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


# ============================================================
# TABLE 2: maintenance_interventions
# Stores every entry from your TechLogPage
# The ML engine reads this to link problems to past work
# ============================================================
class MaintenanceIntervention(Base):
    __tablename__ = "maintenance_interventions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Which conveyor this work was done on
    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)

    # Who wrote this entry (matches user.username from your React AuthContext)
    author: Mapped[str] = mapped_column(String(100))

    # Type of work: MAINTENANCE, INSPECTION, or REPAIR
    intervention_type: Mapped[str] = mapped_column(String(50))

    # The full description text the technician typed
    description: Mapped[str] = mapped_column(Text)


# ============================================================
# TABLE 3: faults_alerts
# Every alert that ever happened — from ESP32 faults OR
# from threshold crossing (temp too high, current too high)
# Maps to your AlertsPage
# ============================================================
class FaultAlert(Base):
    __tablename__ = "faults_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    conveyor_id: Mapped[int] = mapped_column(Integer, default=1)

    # The alert message shown in AlertsPage
    message: Mapped[str] = mapped_column(String(500))

    # "warning" or "critical" — matches your LEVEL_CONFIG in AlertsPage
    level: Mapped[str] = mapped_column(String(20))

    # False = still active, True = resolved by admin/supervisor
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    # When it was resolved (None if not resolved yet)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


# ============================================================
# TABLE 4: users
# For Phase 2 Authentication (JWT, Roles)
# Stores registered users securely with hashed passwords.
# ============================================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Must be unique — used to log in
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # Email requested in addition to standard Phase 2 setup
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    
    # Never store raw passwords! Only the bcrypt hash
    password_hash: Mapped[str] = mapped_column(String(255))
    
    # "admin", "supervisor", "operator", "technician"
    role: Mapped[str] = mapped_column(String(20), default="operator")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # True = can log in, False = soft deleted/deactivated
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)