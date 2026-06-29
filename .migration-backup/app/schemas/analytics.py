from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class AnalyticsCreate(BaseModel):
    metric_name: str = Field(..., examples=["BTC/USDT", "ORDER_BOOK_IMBALANCE", "LATENCY_MS"])
    metric_value: float = Field(..., examples=[64250.50, 0.74, 12.4])
    user_id: Optional[int] = Field(None, examples=[1, 2])
    extra_payload: Optional[Dict[str, Any]] = Field(None, examples=[{"bid_volume": 12.5, "ask_volume": 4.2}])


class AnalyticsResponse(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int]
    metric_name: str
    metric_value: float
    extra_payload: Optional[Dict[str, Any]]
    timestamp: datetime

    model_config = {"from_attributes": True}


class AnalyticsMetrics(BaseModel):
    input_count: int
    applied_period: int
    simple_moving_average: List[float]
    volatility_standard_deviation: List[float]


class TickerCalculateResponse(BaseModel):
    status: str
    metrics: AnalyticsMetrics
    source: str
    computed_at: datetime
    record_id: Optional[int] = None
    persisted_by: Optional[str] = None

    model_config = {"from_attributes": True}


class PaginatedAnalyticsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[AnalyticsResponse]
