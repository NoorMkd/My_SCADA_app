# ============================================================
# ml_engine.py
# The ML Analysis Engine.
#
# Current state: smart placeholder
#   - Uses REAL data from the database
#   - Computes REAL statistics (averages, trends, scores)
#   - Generates natural-language explanations
#   - Rule-based logic (not a trained ML model yet)
#
# Future upgrade path:
#   - Replace compute functions with scikit-learn models
#   - Or send data to an LLM API to generate richer text
#   - Only THIS file changes — nothing else needs updating
#
# Output shape matches AI_DATA in your HistoryPage.jsx exactly
# so React needs zero changes when we upgrade to real ML
# ============================================================

import statistics
from collections import defaultdict
from datetime import datetime, timezone


async def generate_report(
    conveyor_id: int,
    sensors: list,
    maintenance: list,
    alerts: list,
) -> dict:
    """
    Main entry point — called by routers/sensors.py.
    Receives 30 days of data and returns a full report.

    Return shape matches AI_DATA in HistoryPage.jsx:
      efficiencyScore, efficiencyLabel, efficiencyColor,
      explanation, losses, recommendations,
      sensorTrend, efficiencyTrend
    """
    # No data yet → return empty report
    if not sensors:
        return _empty_report(conveyor_id)

    # ── Extract raw values ────────────────────────────────
    temps    = [r.temperature for r in sensors]
    currents = [r.current     for r in sensors]
    speeds   = [r.speed       for r in sensors]

    avg_temp    = statistics.mean(temps)
    avg_current = statistics.mean(currents)
    max_temp    = max(temps)
    max_current = max(currents)

    # ── Efficiency score (0–100) ──────────────────────────
    # How far is the average from the critical limit?
    # Perfect = never near limits = score close to 100
    # Bad     = always near limits = score close to 0
    temp_score    = max(0.0, 100 - (avg_temp    / 75) * 100)
    current_score = max(0.0, 100 - (avg_current / 18) * 100)
    health_score  = round((temp_score + current_score) / 2)

    # ── Production Efficiency ─────────────────────────────
    # Items produced vs theoretical maximum at current speeds
    total_items = sum(1 for r in sensors if r.object_detected)
    # Very simple theoretical max placeholder until we wire the actual logic
    theoretical_max = max(100, int(statistics.mean(speeds) * 5)) 
    production_efficiency = round((total_items / theoretical_max) * 100) if theoretical_max > 0 else 0
    production_efficiency = min(100, production_efficiency)

    # We use health_score for the main color/label logic for now
    efficiency = health_score

    # ── Label and color ───────────────────────────────────
    # Matches the colors already in your HistoryPage.jsx
    if efficiency >= 80:
        label = "SYSTEM OPTIMAL"
        color = "#0098c2"    # pacific blue
    elif efficiency >= 60:
        label = "SYSTEM NOMINAL"
        color = "#d5a507"    # galliano
    else:
        label = "CRITICAL FAILURE"
        color = "#cd6413"    # meteor

    # ── Natural language explanation ──────────────────────
    # Builds a sentence describing what the data shows
    # Future upgrade: send all data to an LLM and ask it
    # to write a detailed paragraph
    issues = []

    if avg_temp > 65:
        issues.append(
            f"average temperature elevated "
            f"({avg_temp:.1f}°C, warning at 65°C)"
        )
    if avg_current > 14:
        issues.append(
            f"current draw above warning level "
            f"({avg_current:.1f}A, warning at 14A)"
        )

    unresolved = [a for a in alerts if not a.resolved]
    if unresolved:
        issues.append(
            f"{len(unresolved)} unresolved fault(s) on record"
        )

    days_since = _days_since_last_maintenance(maintenance)
    if days_since and days_since > 30:
        issues.append(
            f"no maintenance logged in {days_since} days"
        )

    # Add Production Efficiency info
    prod_msg = f"Conveyor produced {total_items} items (≈{production_efficiency}% of theoretical max capacity at current speeds)"

    if issues:
        explanation = (
            f"{prod_msg}. Analysis of the last 30 days shows: "
            + "; ".join(issues) + "."
        )
    else:
        explanation = (
            f"{prod_msg}. Conveyor {conveyor_id} is performing well. "
            "All sensors within normal range. "
            "No anomalies detected over the last 30 days."
        )

    # ── Estimated production losses ───────────────────────
    # Replace money losses with items loss
    gap_pct      = 100 - production_efficiency
    items_lost   = theoretical_max - total_items if theoretical_max > total_items else 0
    loss_7d_pct  = gap_pct
    loss_30d_pct = gap_pct 

    # ── Recommendations ───────────────────────────────────
    recommendations = _build_recommendations(
        avg_temp, avg_current,
        max_temp, max_current,
        unresolved, days_since,
    )

    # ── Chart data ────────────────────────────────────────
    sensor_trend     = _daily_sensor_averages(sensors)
    efficiency_trend = _daily_efficiency_scores(sensors)

    return {
        "conveyor_id":      conveyor_id,
        "generated_at":     datetime.now(timezone.utc).isoformat(),
        "efficiencyScore":  efficiency,
        "efficiencyLabel":  label,
        "efficiencyColor":  color,
        "explanation":      explanation,
        "losses": {
            "sevenDays": {
                "pct": f"−{loss_7d_pct}%",
                "DT":  f"≈ {items_lost} items",
            },
            "thirtyDays": {
                "pct": f"−{loss_30d_pct}%",
                "DT":  f"≈ {items_lost * 4} items",
            },
        },
        "recommendations":  recommendations,
        "sensorTrend":      sensor_trend,
        "efficiencyTrend":  efficiency_trend,
    }


# ── Helper functions ──────────────────────────────────────────

def _days_since_last_maintenance(maintenance: list) -> int | None:
    """Returns how many days since the last maintenance entry"""
    if not maintenance:
        return None
    latest = max(maintenance, key=lambda m: m.timestamp)
    ts = latest.timestamp
    # Make timezone-aware if it isn't already
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - ts
    return delta.days


def _build_recommendations(
    avg_temp, avg_current,
    max_temp, max_current,
    unresolved_alerts, days_since,
) -> list[dict]:
    """
    Builds a prioritized list of action recommendations.
    Returns max 3 items — matches HistoryPage.jsx layout.
    """
    recs  = []
    icons = ["①", "②", "③"]
    i     = 0

    # Critical temperature
    if max_temp >= 75 and i < 3:
        recs.append({
            "num":    icons[i],
            "action": "Inspect motor cooling system — URGENT",
            "impact": f"Peak temperature {max_temp:.0f}°C exceeded critical limit",
            "save":   "−8%",
            "color":  "#cd6413",
            "bg":     "#111d29",
            "border": "#cd641333",
        })
        i += 1

    # Warning temperature
    elif avg_temp > 65 and i < 3:
        recs.append({
            "num":    icons[i],
            "action": "Check motor ventilation",
            "impact": f"Average temp {avg_temp:.1f}°C above warning threshold",
            "save":   "−5%",
            "color":  "#d5a507",
            "bg":     "#111d29",
            "border": "#d5a50733",
        })
        i += 1

    # High current
    if avg_current > 14 and i < 3:
        recs.append({
            "num":    icons[i],
            "action": "Check motor load and belt tension",
            "impact": f"Average current {avg_current:.1f}A above normal range",
            "save":   "−6%",
            "color":  "#d5a507",
            "bg":     "#111d29",
            "border": "#d5a50733",
        })
        i += 1

    # Unresolved alerts
    if unresolved_alerts and i < 3:
        recs.append({
            "num":    icons[i],
            "action": "Review and resolve open fault alerts",
            "impact": f"{len(unresolved_alerts)} fault(s) need attention",
            "save":   "−4%",
            "color":  "#cd6413",
            "bg":     "#111d29",
            "border": "#cd641333",
        })
        i += 1

    # Overdue maintenance
    if days_since and days_since > 30 and i < 3:
        recs.append({
            "num":    icons[i],
            "action": "Schedule preventive maintenance",
            "impact": f"Last maintenance was {days_since} days ago",
            "save":   "−3%",
            "color":  "#0098c2",
            "bg":     "#111d29",
            "border": "#0098c233",
        })
        i += 1

    # Everything is fine
    if not recs:
        recs.append({
            "num":    "①",
            "action": "Continue current maintenance schedule",
            "impact": "All systems within normal range",
            "save":   "+2%",
            "color":  "#0098c2",
            "bg":     "#111d29",
            "border": "#0098c233",
        })

    return recs


def _daily_sensor_averages(sensors: list) -> list[dict]:
    """
    Groups readings by weekday and computes daily averages.
    Returns last 7 days for the sensor trend chart.
    Shape: [{ day, temp, current, speed }, ...]
    """
    days: dict = defaultdict(
        lambda: {"temps": [], "currents": [], "speeds": []}
    )

    for r in sensors:
        day = r.timestamp.strftime("%a")  # "Mon", "Tue" etc.
        days[day]["temps"].append(r.temperature)
        days[day]["currents"].append(r.current)
        days[day]["speeds"].append(r.speed)

    result = []
    for day, data in list(days.items())[-7:]:
        result.append({
            "day":     day,
            "temp":    round(statistics.mean(data["temps"])),
            "current": round(statistics.mean(data["currents"])),
            "speed":   round(statistics.mean(data["speeds"])),
        })

    # Fallback if not enough data yet
    if not result:
        result = [
            {"day": "Mon", "temp": 40, "current": 44, "speed": 50},
            {"day": "Tue", "temp": 42, "current": 46, "speed": 50},
            {"day": "Wed", "temp": 43, "current": 48, "speed": 52},
            {"day": "Thu", "temp": 45, "current": 50, "speed": 55},
            {"day": "Fri", "temp": 48, "current": 52, "speed": 55},
            {"day": "Sat", "temp": 50, "current": 54, "speed": 58},
            {"day": "Sun", "temp": 52, "current": 56, "speed": 60},
        ]

    return result


def _daily_efficiency_scores(sensors: list) -> list[int]:
    """
    Computes one efficiency score per day for last 7 days.
    Returns list of 7 integers e.g. [94, 91, 88, 86, 84, 82, 80]
    Used by the efficiency trend chart in HistoryPage.
    """
    days: dict = defaultdict(list)

    for r in sensors:
        day     = r.timestamp.strftime("%a")
        t_score = max(0.0, 100 - (r.temperature / 75) * 100)
        c_score = max(0.0, 100 - (r.current     / 18) * 100)
        days[day].append(round((t_score + c_score) / 2))

    result = []
    for day, scores in list(days.items())[-7:]:
        result.append(round(statistics.mean(scores)))

    # Fallback if not enough data yet
    return result if result else [80, 82, 81, 83, 82, 84, 83]


def _empty_report(conveyor_id: int) -> dict:
    """
    Returned when no sensor data exists in the database yet.
    Tells React to show a 'no data' state.
    """
    return {
        "conveyor_id":     conveyor_id,
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "efficiencyScore": 0,
        "efficiencyLabel": "NO SIGNAL",
        "efficiencyColor": "#404040",
        "explanation": (
            "System waiting for uplink... "
            "Telemetry stream not detected. "
            "Check Mosquitto broker status."
        ),
        "losses": {
            "sevenDays":  {"pct": "N/A", "DT": "N/A"},
            "thirtyDays": {"pct": "N/A", "DT": "N/A"},
        },
        "recommendations": [],
        "sensorTrend":     [],
        "efficiencyTrend": [],
    }
