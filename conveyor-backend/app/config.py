 # ============================================================
# config.py
# All settings for the entire project live here.
#
# How it works:
#   - We create a class called Settings
#   - Pydantic reads the .env file automatically
#   - Every other file imports "settings" from here
#   - No passwords or secrets ever hardcoded in code
# ============================================================

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # --- Database ---
    # This is the full address of your PostgreSQL database
    # Format: postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE
    DATABASE_URL: str = "postgresql+asyncpg://postgres:Noor1234!@localhost:5432/conveyor_db"

    # --- MQTT Broker (Mosquitto) ---
    # Where Mosquitto is running — on your laptop = localhost
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883

    # --- MQTT Topic ---
    # The "channel" the ESP32 publishes to
    # Your ESP32 code must publish to this exact string
    MQTT_TOPIC: str = "motors/conveyor_1/sensors"

    # --- Conveyor ---
    # Which conveyor ID the ESP32 belongs to
    # We only have one ESP32 → Conveyor 1
    CONVEYOR_ID: int = 1

    # --- Sensor Alert Thresholds ---
    # If temperature goes above these → create an alert
    TEMP_WARNING: float = 65.0   # °C
    TEMP_CRITICAL: float = 75.0  # °C

    # If current goes above these → create an alert
    CURRENT_WARNING: float = 14.0  # Amperes
    CURRENT_CRITICAL: float = 18.0  # Amperes

    # --- Security ---
    SECRET_KEY: str 
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    # Tell Pydantic to read from the .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )


# This is the ONE object every other file will import
# Usage in any file:   from app.config import settings
#                      print(settings.MQTT_BROKER)
settings = Settings()
