from decimal import Decimal
from sqlalchemy import Integer, String, DateTime, ForeignKey, Enum as SQLEnum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.core.database import Base
from typing import Optional
import enum

class OrderType(str, enum.Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"

class OrderSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"

class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    CANCELED = "CANCELED"

class MockWallet(Base):
    __tablename__ = "mock_wallets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(28, 10), nullable=False, default=Decimal("10000.00"))
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    positions = relationship("MockPosition", back_populates="wallet", cascade="all, delete-orphan")
    orders = relationship("MockOrder", back_populates="wallet", cascade="all, delete-orphan")
    user = relationship("UserModel", back_populates="wallet")

class MockPosition(Base):
    __tablename__ = "mock_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wallet_id: Mapped[int] = mapped_column(Integer, ForeignKey("mock_wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(28, 10), nullable=False)
    average_entry_price: Mapped[Decimal] = mapped_column(Numeric(28, 10), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    wallet = relationship("MockWallet", back_populates="positions")

class MockOrder(Base):
    __tablename__ = "mock_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wallet_id: Mapped[int] = mapped_column(Integer, ForeignKey("mock_wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    order_type: Mapped[OrderType] = mapped_column(SQLEnum(OrderType), nullable=False)
    side: Mapped[OrderSide] = mapped_column(SQLEnum(OrderSide), nullable=False)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(28, 10), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(28, 10), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(SQLEnum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    wallet = relationship("MockWallet", back_populates="orders")
