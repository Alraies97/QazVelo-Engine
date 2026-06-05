from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List
from app.services.analytics import MarketAnalyticsService
from app.services.market_data import MarketDataService


router = APIRouter(prefix="/analytics", tags=["Core Analytics"])

class MarketTickerRequest(BaseModel):
    ticker: str = Field(..., description="Stock or Crypto ticker symbol (e.g., AAPL, BTC-USD)", min_length=1)
    period: str = Field("1mo", description="Historical data period: '1mo', '3mo', '6mo', '1y'")
    calculation_window: int = Field(3, description="The sliding window size for SMA/Volatility calculation", gt=0)

    class Config:
        json_schema_extra = {
            "example": {
                "ticker": "BTC-USD",
                "period": "1mo",
                "calculation_window": 3
            }
        }

@router.post("/calculate", status_code=status.HTTP_200_OK)
def calculate_market_metrics(payload: MarketTickerRequest):

    prices = MarketDataService.get_historical_price(
             ticker=payload.ticker,
             period=payload.period
             )

    if not prices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not fetch historical data for ticker '{payload.ticker}'. Please check the symbol."
        )

    result = MarketAnalyticsService.process_market_indicators(
        prices=prices,
        period=payload.calculation_window
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message")
        )

    return result