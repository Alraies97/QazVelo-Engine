from sqlalchemy import Integer, String, Float, DateTime, Boolean, Enum as SQLEnum, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.core.database import Base
import enum


class AlertCondition(str, enum.Enum):
    ABOVE = "above"
    BELOW = "below"


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    asset_symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    condition: Mapped[AlertCondition] = mapped_column(SQLEnum(AlertCondition), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Composite index for fast active alert queries by asset
    __table_args__ = (
        Index("idx_asset_active", "asset_symbol", "is_active"),
    )
