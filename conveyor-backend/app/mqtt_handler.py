#This is the heart of the backend. This file:
#Connects to Mosquitto
#Listens for ESP32 messages 24/7
#Validates the data
#Saves it to the database
#Checks thresholds → creates alerts if needed
#Pushes live data to React via SSE

 # mqtt_handler.py
# Receives ESP32 data and dispatches it to the rest of the app.
#
# ── Important concept: two worlds ───
# paho-mqtt runs in its own THREAD (old-style blocking code)
# FastAPI runs in an async EVENT LOOP (modern non-blocking)
#
# These two worlds cannot talk directly.
# Bridge: asyncio.run_coroutine_threadsafe()
#   → safely hands work from paho thread → async loop
#
# Think of it like this:
#   paho thread = a worker in room A
#   async loop  = a worker in room B
#   bridge      = a hatch between the two rooms
# ********************************************************

import asyncio
import json
import threading
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt

from app.config import settings
from app.schemas import SensorPayload


# ── Internal state ───
# These are set once at startup by main.py
# before the MQTT thread starts

# The FastAPI async event loop (room B)
_loop: Optional[asyncio.AbstractEventLoop] = None

# The SSEManager instance (to push data to React)
_sse_manager = None

# The database session factory (to save data)
_session_factory = None


def init_mqtt_handler(
    loop: asyncio.AbstractEventLoop,
    sse_manager,
    session_factory,
):
    """
    Called once at startup in main.py.
    Gives this module what it needs to operate:
      - loop          → the async event loop to submit work to
      - sse_manager   → to broadcast live data to React
      - session_factory → to open database sessions
    """
    global _loop, _sse_manager, _session_factory
    _loop = loop
    _sse_manager = sse_manager
    _session_factory = session_factory
    print("[MQTT] Handler initialized")


# ── paho-mqtt callbacks ───────────────────────────────────────
# These functions are called automatically by paho
# when specific events happen

def on_connect(client, userdata, flags, reason_code, properties=None):
    """
    Called when paho successfully connects to Mosquitto.
    We subscribe to the ESP32 topic here.
    Subscribing inside on_connect is best practice because
    paho will re-subscribe automatically if it reconnects.
    """
    if reason_code == 0:
        print(f"[MQTT] Connected to Mosquitto at "
              f"{settings.MQTT_BROKER}:{settings.MQTT_PORT}")
        # Subscribe to the ESP32 topic
        # qos=0 means: deliver at most once (fast, no acknowledgment)
        client.subscribe(settings.MQTT_TOPIC, qos=0)
        print(f"[MQTT] Subscribed to: {settings.MQTT_TOPIC}")
    else:
        print(f"[MQTT] Connection failed — code: {reason_code}")
        print("[MQTT] Is Mosquitto running?")


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    """
    Called when connection to Mosquitto is lost.
    paho will reconnect automatically — we just log it.
    """
    print(f"[MQTT] Disconnected (code: {reason_code})")
    print("[MQTT] Attempting to reconnect...")


def on_message(client, userdata, msg):
    """
    Called every time the ESP32 sends a message.
    This runs in the paho THREAD.

    We immediately hand the work to the async loop
    using the bridge (run_coroutine_threadsafe).
    We do NOT do heavy work here — just pass it on.
    """
    try:
        # Decode the raw bytes to a string
        raw = msg.payload.decode("utf-8")

        # Parse the JSON string into a Python dict
        payload = json.loads(raw)

        print(f"[MQTT] Received: {payload}")

        # ── Bridge: thread → async loop ───────────────────
        # asyncio.run_coroutine_threadsafe safely submits
        # an async function to the event loop from a thread
        if _loop and _sse_manager and _session_factory:
            asyncio.run_coroutine_threadsafe(
                _process_message(payload),
                _loop,
            )
        else:
            print("[MQTT] Warning: not initialized yet")

    except json.JSONDecodeError:
        print(f"[MQTT] Invalid JSON received: {msg.payload}")
    except Exception as e:
        print(f"[MQTT] Error in on_message: {e}")


# ── Core async processing ─────────────────────────────────────

async def _process_message(payload: dict):
    """
    Runs in the async event loop (room B).
    Does all the heavy work:
      1. Validate data with Pydantic
      2. Save to database
      3. Check thresholds → create alerts
      4. Count items_today and runtime_seconds
      5. Push to React via SSE
    """
    from app import crud

    try:
        # ── Step 1: Validate with Pydantic ────────────────
        # SensorPayload checks types and caps speed at 100
        sensor = SensorPayload(**payload)

    except Exception as e:
        print(f"[MQTT] Invalid payload — skipping: {e}")
        return

    # ── Step 2: Save to database ──────────────────────────
    async with _session_factory() as db:

        data = {
            "conveyor_id": settings.CONVEYOR_ID,
            "speed":            sensor.speed,
            "current":          sensor.current,
            "temperature":      sensor.temperature,
            "rpm":              sensor.rpm,
            "object_detected":  sensor.object_detected,
            "status":           sensor.status,
            "fault":            sensor.fault,
        }

        await crud.save_sensor_reading(db, data)

        # ── Step 3: Auto-create alerts ────────────────────
        # Alert from ESP32 fault field
        if sensor.fault:
            await crud.create_alert(
                db,
                conveyor_id=settings.CONVEYOR_ID,
                message=f"ESP32 fault: {sensor.fault}",
                level="critical",
            )

        # Alert from temperature threshold
        if sensor.status == "running":
            if sensor.temperature >= settings.TEMP_CRITICAL:
                await crud.create_alert(
                    db,
                    conveyor_id=settings.CONVEYOR_ID,
                    message=(
                        f"Temperature critical: {sensor.temperature}°C "
                        f"exceeded limit of {settings.TEMP_CRITICAL}°C"
                    ),
                    level="critical",
                )
            elif sensor.temperature >= settings.TEMP_WARNING:
                await crud.create_alert(
                    db,
                    conveyor_id=settings.CONVEYOR_ID,
                    message=(
                        f"Temperature warning: {sensor.temperature}°C "
                        f"approaching limit"
                    ),
                    level="warning",
                )

            # Alert from current threshold
            if sensor.current >= settings.CURRENT_CRITICAL:
                await crud.create_alert(
                    db,
                    conveyor_id=settings.CONVEYOR_ID,
                    message=(
                        f"Current critical: {sensor.current}A "
                        f"exceeded limit of {settings.CURRENT_CRITICAL}A"
                    ),
                    level="critical",
                )
            elif sensor.current >= settings.CURRENT_WARNING:
                await crud.create_alert(
                    db,
                    conveyor_id=settings.CONVEYOR_ID,
                    message=(
                        f"Current rising: {sensor.current}A "
                        f"approaching limit"
                    ),
                    level="warning",
                )

        # ── Step 4: Count stats ───────────────────────────
        items_today = await crud.count_items_today(
            db, settings.CONVEYOR_ID
        )
        runtime_seconds = await crud.count_runtime_seconds(
            db, settings.CONVEYOR_ID
        )

    # ── Step 5: Push to React via SSE ────────────────────
    live_data = {
        "conveyor_id":      settings.CONVEYOR_ID,
        "speed":            sensor.speed,
        "current":          sensor.current,
        "temperature":      sensor.temperature,
        "rpm":              sensor.rpm,
        "object_detected":  sensor.object_detected,
        "status":           sensor.status,
        "fault":            sensor.fault,
        "is_running":       sensor.status == "running",
        "items_today":      items_today,
        "runtime_seconds":  runtime_seconds,
        "timestamp":        datetime.now(timezone.utc).isoformat(),
    }

    await _sse_manager.broadcast(live_data)
    print(
        f"[SSE] Pushed → "
        f"temp={sensor.temperature}°C "
        f"cur={sensor.current}A "
        f"spd={sensor.speed}% "
        f"items={items_today}"
    )


# ── MQTT client startup ───────────────────────────────────────

def _run_mqtt_forever():
    """
    Blocking function — runs paho's network loop forever.
    NEVER call this on the main thread — it blocks!
    Always runs in a background daemon thread.
    """
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    # Register our callback functions
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_message    = on_message

    try:
        client.connect(
            settings.MQTT_BROKER,
            settings.MQTT_PORT,
            keepalive=60,  # send ping every 60s to keep connection alive
        )
        # loop_forever = runs until the program stops
        # retry_first_connection=True = keep trying if broker is down
        client.loop_forever(retry_first_connection=True)

    except Exception as e:
        print(f"[MQTT] Could not connect: {e}")
        print("[MQTT] Make sure Mosquitto is installed and running")


def start_mqtt():
    """
    Starts the MQTT listener in a background daemon thread.

    daemon=True means: when the app stops, this thread
    stops automatically — no manual cleanup needed.
    """
    thread = threading.Thread(
        target=_run_mqtt_forever,
        daemon=True,
        name="mqtt-thread",
    )
    thread.start()
    print("[MQTT] Background thread started")
    return thread
