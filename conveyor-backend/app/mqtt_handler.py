# mqtt_handler.py
import asyncio
import json
import threading
import traceback
import time
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

_prev_s1_state: bool = False

# ── Motor state tracked server-side ───
_motor_running: bool = False


def init_mqtt_handler(loop, sse_manager, session_factory):
    global _loop, _sse_manager, _session_factory
    _loop = loop
    _sse_manager = sse_manager
    _session_factory = session_factory
    print("[MQTT] Handler initialized")


# ── paho-mqtt callbacks ───

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"[MQTT] Connected to Mosquitto at "
              f"{settings.MQTT_BROKER}:{settings.MQTT_PORT}")
        result, mid = client.subscribe(settings.MQTT_TOPIC, qos=0)
        print(f"[MQTT] subscribe() called  topic={settings.MQTT_TOPIC!r}  "
              f"result={result}  mid={mid}")
        print(f"[MQTT] Subscribed to: {settings.MQTT_TOPIC}")
    else:
        print(f"[MQTT] Connection failed — code: {reason_code}")
        print("[MQTT] Is Mosquitto running?")


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    print(f"[MQTT] Disconnected (code: {reason_code})")
    print("[MQTT] Attempting to reconnect...")


def on_message(client, userdata, msg):
    try:
        raw = msg.payload.decode("utf-8")
        print(f"[MQTT] RAW ← topic={msg.topic!r}  payload={raw!r}")
        payload = json.loads(raw)
        print(f"[MQTT] Received: {payload}")

        if _loop and _sse_manager and _session_factory:
            asyncio.run_coroutine_threadsafe(_process_message(payload), _loop)
        else:
            print("[MQTT] Warning: not initialized yet")

    except json.JSONDecodeError:
        print(f"[MQTT] Invalid JSON received: {msg.payload}")
    except Exception as e:
        print(f"[MQTT] Error in on_message: {e}")


# ── Core async processing ─────────────────────────────────────

async def _process_message(payload: dict):
    from app import crud
    global _prev_s1_state, _motor_running

    try:
        # ── Step 1: Validate with Pydantic ──
        try:
            sensor = SensorPayload(**payload)
        except Exception as e:
            print(f"[MQTT] Invalid payload — skipping: {e}")
            return

        # ── Safe getters ──
        def num(v, default=0.0):
            return float(v) if v is not None else float(default)

        # ── Map ESP32 fields ──
        temperature_val = num(sensor.temperature, 0)
        current_val     = num(sensor.current, 0)
        freq_hz_val     = num(getattr(sensor, "freq_hz", None), 0)
        speed_val       = round(freq_hz_val, 1)

        raw_rpm = getattr(sensor, "rpm", None)
        rpm_val = float(raw_rpm) if raw_rpm is not None else None

        status_val      = "running" if _motor_running else "stopped"
        fault_val       = None
        object_detected = (sensor.event == "item_passed")     
        items_today     = int(sensor.item_count or 0)

        print(f"[ITEMS] count={items_today}")

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
                "belt_speed_mps":  None,
            }
            await crud.save_sensor_reading(db, data)

            config          = await crud.get_production_config(db)
            runtime_seconds = await crud.count_runtime_seconds(db, settings.CONVEYOR_ID)

        # ── Step 4: Push to React via SSE ──
        live_data = {
            "conveyor_id":     settings.CONVEYOR_ID,
            "speed":           speed_val,
            "current":         current_val,
            "temperature":     temperature_val,
            "rpm":             rpm_val,
            "freq_hz":         freq_hz_val,
            "object_detected": object_detected,
            "status":          status_val,
            "fault":           fault_val,
            "is_running":      _motor_running,
            "items_today":     items_today,
            "daily_target":    config.todays_target,
            "max_freq_hz":     config.max_freq_hz,
            "min_freq_hz":     config.min_freq_hz,
            "runtime_seconds": runtime_seconds,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }

        await _sse_manager.broadcast(live_data)
        print(
            f"[SSE] Pushed → "
            f"temp={temperature_val}°C  cur={current_val}A  "
            f"spd={speed_val}Hz  rpm={rpm_val}  "
            f"items={items_today}"
        )

    except Exception as e:
        print(f"[MQTT] Error processing message: {e}")
        traceback.print_exc()
# ── MQTT client startup ───────────────────────────────────────

def _run_mqtt_forever():
    global _mqtt_client
    _mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    _mqtt_client.on_connect    = on_connect
    _mqtt_client.on_disconnect = on_disconnect
    _mqtt_client.on_message    = on_message
    _mqtt_client.reconnect_delay_set(min_delay=2, max_delay=30)

    while True:
        try:
            _mqtt_client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, keepalive=60)
            _mqtt_client.loop_forever()
        except Exception as e:
            print(f"[MQTT] Could not connect to broker: {e}")
            print(f"[MQTT] Retrying in 5 seconds...")
            time.sleep(5)


def publish_freq_config(max_hz: float, min_hz: float) -> bool:
    if _mqtt_client is None or not _mqtt_client.is_connected():
        print("[MQTT] Error: Client not connected, cannot publish freq config.")
        return False
    import json as _json
    payload = _json.dumps({"cmd": "set_freq_limits", "max_hz": max_hz, "min_hz": min_hz})
    _mqtt_client.publish(settings.MQTT_TOPIC_COMMANDS, payload, qos=1)
    print(f"[MQTT] Freq config sent → max={max_hz} Hz  min={min_hz} Hz")
    return True


def publish_command(command: str):
    global _motor_running

    if _mqtt_client is None or not _mqtt_client.is_connected():
        print("[MQTT] Error: Client not connected, cannot publish command.")
        return False

    if command == "start":
        _motor_running = True
    elif command == "stop":
        _motor_running = False

    topic = settings.MQTT_TOPIC_COMMANDS
    _mqtt_client.publish(topic, command, qos=0)
    print(f"[MQTT] Published to {topic}: {command}  (motor_running={_motor_running})")
    return True


def start_mqtt():
    thread = threading.Thread(target=_run_mqtt_forever, daemon=True, name="mqtt-thread")
    thread.start()
    print("[MQTT] Background thread started")
    return thread