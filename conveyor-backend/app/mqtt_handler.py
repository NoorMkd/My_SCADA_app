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
# ********************************************************

import asyncio
import json
import threading
import traceback
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt

from app.config import settings
from app.schemas import SensorPayload


# ── Internal state ───
_loop: Optional[asyncio.AbstractEventLoop] = None
_sse_manager = None
_session_factory = None
_mqtt_client: Optional[mqtt.Client] = None


def init_mqtt_handler(
    loop: asyncio.AbstractEventLoop,
    sse_manager,
    session_factory,
):
    """
    Called once at startup in main.py.
    """
    global _loop, _sse_manager, _session_factory
    _loop = loop
    _sse_manager = sse_manager
    _session_factory = session_factory
    print("[MQTT] Handler initialized")


# ── paho-mqtt callbacks ───────────────────────────────────────

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"[MQTT] Connected to Mosquitto at "
              f"{settings.MQTT_BROKER}:{settings.MQTT_PORT}")
        client.subscribe(settings.MQTT_TOPIC, qos=0)
        print(f"[MQTT] Subscribed to: {settings.MQTT_TOPIC}")
    else:
        print(f"[MQTT] Connection failed — code: {reason_code}")
        print("[MQTT] Is Mosquitto running?")


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    print(f"[MQTT] Disconnected (code: {reason_code})")
    print("[MQTT] Attempting to reconnect...")


def on_message(client, userdata, msg):
    """
    Called every time the ESP32 sends a message.
    Runs in the paho THREAD — hands work off to the async loop.
    """
    try:
        raw = msg.payload.decode("utf-8")
        payload = json.loads(raw)
        print(f"[MQTT] Received: {payload}")

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
    Runs in the async event loop. Validates, saves, alerts, broadcasts.
    The outer try/except is CRITICAL — without it, errors inside
    run_coroutine_threadsafe vanish into an unawaited Future and the
    dashboard silently freezes while MQTT messages keep arriving.
    """
    from app import crud

    try:
        # ── Step 1: Validate with Pydantic ──
        try:
            sensor = SensorPayload(**payload)
        except Exception as e:
            print(f"[MQTT] Invalid payload — skipping: {e}")
            return

        # ── Safe getters — handle None / missing fields gracefully ──
        def num(v, default=0.0):
            """Convert v to float, or return default if v is None."""
            return float(v) if v is not None else float(default)

        # ── Map ESP32 schema → dashboard schema ──
        temperature_val = num(sensor.temperature, 0)
        current_val     = num(sensor.current,     0)
        rpm_val         = int(num(getattr(sensor, "speed_rpm", None), 0))
        freq_hz_val     = num(getattr(sensor, "freq_hz", None), 0)
        # speed % — adjust formula to whatever the dashboard expects.
        # 50 Hz ≈ 100 % gives a simple x2 mapping for now.
        speed_val       = int(freq_hz_val * 2)
        status_val      = "running" if sensor.motor_on else "stopped"
        fault_val       = None     # ESP32 doesn't report faults yet
        object_detected = bool(getattr(sensor, "s1_state", False)
                            or getattr(sensor, "s2_state", False))
        items_today     = getattr(sensor, "item_count", 0) or 0

        # ── Step 2: Save to database ──
        async with _session_factory() as db:
            data = {
                "conveyor_id":     settings.CONVEYOR_ID,
                "speed":           speed_val,
                "current":         current_val,
                "temperature":     temperature_val,
                "rpm":             rpm_val,
                "object_detected": object_detected,
                "status":          status_val,
                "fault":           fault_val,
            }
            await crud.save_sensor_reading(db, data)

            # ── Step 3: Threshold alerts ──
            if status_val == "running":
                if temperature_val >= settings.TEMP_CRITICAL:
                    await crud.create_alert(
                        db, conveyor_id=settings.CONVEYOR_ID,
                        message=(
                            f"Temperature critical: {temperature_val}°C "
                            f"exceeded limit of {settings.TEMP_CRITICAL}°C"
                        ),
                        level="critical",
                    )
                elif temperature_val >= settings.TEMP_WARNING:
                    await crud.create_alert(
                        db, conveyor_id=settings.CONVEYOR_ID,
                        message=(
                            f"Temperature warning: {temperature_val}°C "
                            f"approaching limit"
                        ),
                        level="warning",
                    )

                if current_val >= settings.CURRENT_CRITICAL:
                    await crud.create_alert(
                        db, conveyor_id=settings.CONVEYOR_ID,
                        message=(
                            f"Current critical: {current_val}A "
                            f"exceeded limit of {settings.CURRENT_CRITICAL}A"
                        ),
                        level="critical",
                    )
                elif current_val >= settings.CURRENT_WARNING:
                    await crud.create_alert(
                        db, conveyor_id=settings.CONVEYOR_ID,
                        message=(
                            f"Current rising: {current_val}A "
                            f"approaching limit"
                        ),
                        level="warning",
                    )

            # ── Step 4: Stats ──
            config = await crud.get_production_config(db)
            runtime_seconds = await crud.count_runtime_seconds(
                db, settings.CONVEYOR_ID
            )

        # ── Step 5: Push to React via SSE ──
        live_data = {
            "conveyor_id":     settings.CONVEYOR_ID,
            "speed":           speed_val,
            "current":         current_val,
            "temperature":     temperature_val,
            "rpm":             rpm_val,
            "object_detected": object_detected,
            "status":          status_val,
            "fault":           fault_val,
            "is_running":      sensor.motor_on,
            "items_today":     items_today,
            "daily_target":    config.todays_target,
            "runtime_seconds": runtime_seconds,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }

        await _sse_manager.broadcast(live_data)
        print(
            f"[SSE] Pushed → "
            f"temp={temperature_val}°C "
            f"cur={current_val}A "
            f"spd={speed_val}% "
            f"items={items_today}"
        )

    except Exception as e:
        # CRITICAL: catches anything that would otherwise be silent.
        print(f"[MQTT] Error processing message: {e}")
        traceback.print_exc()


# ── MQTT client startup ───────────────────────────────────────

def _run_mqtt_forever():
    """
    Blocking function — runs paho's network loop forever.
    NEVER call this on the main thread — it blocks!
    Always runs in a background daemon thread.
    """
    global _mqtt_client
    _mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    _mqtt_client.on_connect    = on_connect
    _mqtt_client.on_disconnect = on_disconnect
    _mqtt_client.on_message    = on_message

    try:
        _mqtt_client.connect(
            settings.MQTT_BROKER,
            settings.MQTT_PORT,
            keepalive=60,
        )
        _mqtt_client.loop_forever(retry_first_connection=True)

    except Exception as e:
        print(f"[MQTT] Could not connect: {e}")
        print("[MQTT] Make sure Mosquitto is installed and running")


def publish_command(payload_dict: dict):
    """
    Publishes a JSON command to the ESP32.
    Called by FastAPI routers natively.
    """
    if _mqtt_client is None or not _mqtt_client.is_connected():
        print("[MQTT] Error: Client not connected, cannot publish command.")
        return False

    topic = settings.MQTT_TOPIC_COMMANDS
    payload = json.dumps(payload_dict)

    _mqtt_client.publish(topic, payload, qos=0)
    print(f"[MQTT] Published command to {topic}: {payload}")
    return True


def start_mqtt():
    """
    Starts the MQTT listener in a background daemon thread.
    """
    thread = threading.Thread(
        target=_run_mqtt_forever,
        daemon=True,
        name="mqtt-thread",
    )
    thread.start()
    print("[MQTT] Background thread started")
    return thread