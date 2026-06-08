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

    # The topic for sending commands back to the ESP32
    # Must match MQTT_TOPIC_CMD in the ESP32 firmware
    MQTT_TOPIC_COMMANDS: str = "motors/conveyor_1/control"

    # --- Conveyor ---
    # Which conveyor ID the ESP32 belongs to
    # We only have one ESP32 → Conveyor 1
    CONVEYOR_ID: int = 1

    # --- Sensor Alert Thresholds ---
    # If temperature goes above these → create an alert
    TEMP_WARNING: float = 50.0   # °C
    TEMP_CRITICAL: float = 80.5  # °C

    # If current goes above these → create an alert
    CURRENT_WARNING: float = 5.0  # Amperes
    CURRENT_CRITICAL: float = 10.0  # Amperes

    # --- Security ---
    SECRET_KEY: str 
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    ALERT_EMAIL_SENDER: str = "alertsconveyor@gmail.com"
    ALERT_EMAIL_PASSWORD: str = ""
    ALERT_EMAIL_RECEIVER: str = "normkd111@gmail.com"

    # Tell Pydantic to read from the .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )


# This is the ONE object every other file will import
# Usage in any file:   from app.config import settings
#                      print(settings.MQTT_BROKER)
settings = Settings()
