from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.core.database import Base
from typing import Optional

class AnalyticsModel(Base):
    __tablename__ = "analytics_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    metric_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    
    extra_payload: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("UserModel", back_populates="analytics")