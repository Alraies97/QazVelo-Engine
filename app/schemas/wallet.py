from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# Reuse the model-layer enums as the single source of truth so that values
# parsed from requests compare equal to the enums used in the service/worker.
from app.models.wallet import OrderType, OrderSide, OrderStatus

# MockWallet Schemas
class MockWalletBase(BaseModel):
    balance: float = Field(10000.0, ge=0.0)
    currency: str = Field("USD")

class MockWalletCreate(MockWalletBase):
    user_id: int

class MockWalletResponse(MockWalletBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

# MockPosition Schemas
class MockPositionBase(BaseModel):
    asset_symbol: str
    quantity: float = Field(gt=0.0)
    average_entry_price: float = Field(gt=0.0)

class MockPositionCreate(MockPositionBase):
    wallet_id: int

class MockPositionResponse(MockPositionBase):
    id: int
    wallet_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}

# MockOrder Schemas
class MockOrderBase(BaseModel):
    asset_symbol: str
    order_type: OrderType
    side: OrderSide
    price: Optional[float] = Field(None, ge=0.0)
    quantity: float = Field(gt=0.0)

class MockOrderCreate(MockOrderBase):
    wallet_id: int

class MockOrderResponse(MockOrderBase):
    id: int
    wallet_id: int
    status: OrderStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletSummaryResponse(BaseModel):
    wallet: MockWalletResponse
    positions: list[MockPositionResponse]
    recent_orders: list[MockOrderResponse]

    model_config = {"from_attributes": True}
