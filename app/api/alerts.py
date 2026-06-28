from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.core.database import get_db
from app.api.users import get_current_user
from app.models.users import UserModel
from app.models.alerts import PriceAlert, AlertCondition
from pydantic import BaseModel, Field
from datetime import datetime


class PriceAlertCreate(BaseModel):
    asset_symbol: str = Field(..., description="Asset symbol (e.g., BTC, AAPL)")
    target_price: float = Field(..., gt=0.0, description="Target price to trigger alert")
    condition: AlertCondition = Field(..., description="Condition: 'above' or 'below' target price")


class PriceAlertResponse(BaseModel):
    id: int
    user_id: int
    asset_symbol: str
    target_price: float
    condition: AlertCondition
    is_active: bool
    triggered_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/alerts", tags=["Price Alerts"])


@router.post("", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert_data: PriceAlertCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_alert = PriceAlert(
        user_id=current_user.id,
        asset_symbol=alert_data.asset_symbol,
        target_price=alert_data.target_price,
        condition=alert_data.condition
    )
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)
    return PriceAlertResponse.model_validate(new_alert)


@router.get("", response_model=List[PriceAlertResponse])
async def list_user_alerts(
    is_active: bool | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(PriceAlert).where(PriceAlert.user_id == current_user.id)
    if is_active is not None:
        query = query.where(PriceAlert.is_active == is_active)
    query = query.order_by(PriceAlert.created_at.desc())

    result = await db.execute(query)
    alerts = result.scalars().all()
    return [PriceAlertResponse.model_validate(alert) for alert in alerts]


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PriceAlert).where(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
