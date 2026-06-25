from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class AnalyticsCreate(BaseModel):
    metric_name: str = Field(..., examples=["BTC/USDT", "ORDER_BOOK_IMBALANCE", "LATENCY_MS"])
    metric_value: float = Field(..., examples=[64250.50, 0.74, 12.4])
    extra_payload: Optional[Dict[str, Any]] = Field(None, examples=[{"bid_volume": 12.5, "ask_volume": 4.2}])


class AnalyticsResponse(BaseModel):
    id: int
    user_id: int
    metric_name: str
    metric_value: float
    extra_payload: Optional[Dict[str, Any]]
    timestamp: datetime

    class Config:
        from_attributes = True 