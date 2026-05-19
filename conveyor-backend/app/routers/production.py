from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.database import get_db
from app.schemas import ProductionConfigIn, ProductionConfigOut
from app.crud import get_production_config, update_production_config
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/production", tags=["production"])

@router.get("/config", response_model=ProductionConfigOut)
async def read_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Read the current production configuration."""
    config = await get_production_config(db)
    return config

@router.put("/config", response_model=ProductionConfigOut)
async def update_config(
    config_in: ProductionConfigIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update the current production configuration. Only admin and operator allowed."""
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized to update config.")
    config = await update_production_config(db, config_in.model_dump())
    return config
