from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List
from app.services.analytics import MarketAnalyticsService

router = APIRouter(prefix="/analytics", tags=["Core Analytics"])

class AnalyticsRequest(BaseModel):
    prices: List[float] = Field(..., description="List of price data points", min_items=1)
    period: int = Field(..., gt=0, description="Number of periods for calculations")

    class Config:
        json_schema_extra = {
            "example": {
                "prices": [100.0, 102.5, 101.0, 105.0, 110.0],
                "period": 3
            }
        }

@router.post("/calculate", status_code=status.HTTP_200_OK)
def calculate_market_metrics(payload: AnalyticsRequest):

    result = MarketAnalyticsService.process_market_indicators(
        prices=payload.prices,
        period=payload.period
        )

    if result["status"] == "error":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message")
            )

    
    return result