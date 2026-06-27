from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from fastapi_limiter.depends import RateLimiter
from app.core.database import get_db
from app.api.users import get_current_user
from app.models.users import UserModel
from app.models.analytics import AnalyticsModel
from app.schemas.analytics import AnalyticsResponse, PaginatedAnalyticsResponse
from app.services.analytics import MarketAnalyticsService
from app.services.market_data import MarketDataService
from typing import Dict, Any
from app.core.database import AsyncSessionLocal


router = APIRouter(prefix="/analytics", tags=["Core Analytics"])




class MarketTickerRequest(BaseModel):
    ticker: str = Field(..., description="Stock or Crypto ticker symbol (e.g., AAPL, BTC-USD)", min_length=1)
    period: str = Field("1mo", description="Historical data period: '1mo', '3mo', '6mo', '1y'")
    calculation_window: int = Field(3, description="The sliding window size for SMA/Volatility calculation", gt=0)

    model_config = {
        "json_schema_extra": {
            "example": {
                "ticker": "BTC-USD",
                "period": "1mo",
                "calculation_window": 3,
            }
        }
    }

@router.get("/live-calculate", response_model=Dict[str, Any])
async def get_market_calculations(
    metric_name: str = Query(..., description="e.g"),
    period: int = Query(5, description="e.g"),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await MarketAnalyticsService.get_live_market_analytics(
            db=db, 
            metric_name=metric_name, 
            period=period
        )
        
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
            
        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")



@router.post(
    "/ticker-calculate",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=10, seconds=60))],
)
async def calculate_market_metrics(
    request: Request,
    payload: MarketTickerRequest,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prices = MarketDataService.get_historical_price(
        ticker=payload.ticker,
        period=payload.period,
    )

    if not prices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not fetch historical data for ticker '{payload.ticker}'. Please check the symbol.",
        )

    result = MarketAnalyticsService.process_market_indicators(
        prices=prices,
        period=payload.calculation_window,
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message"),
        )

    metrics = result["metrics"]
    sma_values: list = metrics.get("simple_moving_average", [])
    last_sma: float = sma_values[-1] if sma_values else 0.0

    db_record = AnalyticsModel(
        user_id=current_user.id,
        metric_name=f"{payload.ticker}:SMA_{payload.calculation_window}",
        metric_value=last_sma,
        extra_payload={
            "ticker": payload.ticker,
            "period": payload.period,
            "calculation_window": payload.calculation_window,
            **metrics,
        },
    )
    db.add(db_record)
    await db.commit()
    await db.refresh(db_record)

    return {
        **result,
        "record_id": db_record.id,
        "persisted_by": current_user.username,
    }


@router.get(
    "/history",
    response_model=PaginatedAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=30, seconds=60))],
)
async def get_analytics_history(
    request: Request,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page (max 100)"),
):
    offset = (page - 1) * page_size

    count_result = await db.execute(
        select(func.count(AnalyticsModel.id)).where(
            AnalyticsModel.user_id == current_user.id
        )
    )
    total: int = count_result.scalar_one()

    rows_result = await db.execute(
        select(AnalyticsModel)
        .where(AnalyticsModel.user_id == current_user.id)
        .order_by(AnalyticsModel.timestamp.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = rows_result.scalars().all()

    return PaginatedAnalyticsResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=rows,
    )
