# create_tables.py
from app.database import engine, Base
from app.models import *  # This imports all your models (SensorReading, FaultAlert, etc.)

print("🔧 Creating all database tables...")

# Create all tables (including TimescaleDB hypertable for sensor_readings)
Base.metadata.create_all(bind=engine)

print("✅ All tables created successfully!")
print("   → sensor_readings is now a TimescaleDB hypertable")