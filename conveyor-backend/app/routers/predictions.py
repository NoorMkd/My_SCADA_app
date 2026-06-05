# ============================================================
# routers/predictions.py
# API endpoint that runs all 5 indicators and returns
# a combined JSON to the React dashboard.
# ============================================================

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app import ml_engine

from sqlalchemy import select
from app.models import MLPrediction

router = APIRouter(prefix="/api", tags=["predictions"])

@router.get("/conveyor/{conveyor_id}/predictions/latest")
async def get_latest_prediction(conveyor_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns the latest ML predictions for a given conveyor.
    """
    result = await db.execute(
        select(MLPrediction)
        .where(MLPrediction.conveyor_id == conveyor_id)
        .order_by(MLPrediction.timestamp.desc())
        .limit(1)
    )
    prediction = result.scalars().first()
    
    if not prediction:
        return {"error": "No predictions found"}
        
    return {
        "anomaly": {
            "score": prediction.anomaly_score,
            "label": prediction.anomaly_label,
            "explanation": prediction.anomaly_explanation
        },
        "rul": {
            "days": prediction.rul_days,
            "label": prediction.rul_label,
            "explanation": prediction.rul_explanation
        },
        "alert": {
            "label": prediction.alert_label,
            "count": prediction.alert_count,
            "recommendation": prediction.alert_recommendation
        },
        "oee": {
            "score": prediction.oee_score,
            "items_today": prediction.oee_items_today,
            "theoretical_max": prediction.oee_theoretical_max,
            "items_lost": prediction.oee_items_lost,
            "explanation": prediction.oee_explanation
        },
        "maintenance": {
            "score": prediction.maintenance_score,
            "days_since_last": prediction.maintenance_days_since,
            "recommendation": prediction.maintenance_recommendation
        }
    }


@router.post("/predictions")
async def get_predictions(data: dict, db: AsyncSession = Depends(get_db)):
    """
    POST /api/predictions
    
    Expects JSON body:
    {
        "belt_speed": 0.78,
        "vfd_frequency": 50,
        "expected_speed": 0.8,
        "speed_deviation": -0.02,
        "temperature": 58.3,
        "current": 2.4,
        "items_count": 35,
        "days_since_maintenance": 7,
        "interventions_30d": 2,
        "theoretical_max": 50
    }
    """

    # extract values from request
    belt_speed            = data.get("belt_speed", 0)
    speed_deviation       = data.get("speed_deviation", 0)
    temperature           = data.get("temperature", 0)
    current               = data.get("current", 0)
    items_count           = data.get("items_count", 0)
    days_since_maint      = data.get("days_since_maintenance", 0)
    interventions_30d     = data.get("interventions_30d", 0)
    theoretical_max       = data.get("theoretical_max", 50)

    # ── run the 3 ML models ───────────────────────────────
    anomaly    = ml_engine.predict_anomaly(
                    belt_speed, speed_deviation,
                    temperature, current, items_count)

    rul        = ml_engine.predict_rul(
                    belt_speed, speed_deviation,
                    temperature, current,
                    days_since_maint, interventions_30d)

    alert      = ml_engine.predict_alert(
                    belt_speed, speed_deviation,
                    temperature, current, items_count,
                    days_since_maint, interventions_30d)

    # ── run the 2 math KPIs ───────────────────────────────
    oee         = ml_engine.calculate_oee(items_count, theoretical_max)
    maintenance = ml_engine.calculate_maintenance_due(days_since_maint)

    # ── return combined result ────────────────────────────
    return {
        "anomaly":     anomaly,
        "rul":         rul,
        "alert":       alert,
        "efficiency":  oee,
        "maintenance": maintenance
    }