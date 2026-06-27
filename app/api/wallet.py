from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.users import get_current_user
from app.models.users import UserModel
from app.schemas.wallet import (
    MockWalletResponse,
    MockPositionResponse,
    MockOrderCreate,
    MockOrderResponse
)
from app.services.wallet import WalletService
from typing import Dict

router = APIRouter(prefix="/wallet", tags=["Mock Wallet"])


@router.post("", response_model=MockWalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    initial_balance: float = 10000.0,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wallet = await WalletService.create_wallet(db, current_user.id, initial_balance)
    return MockWalletResponse.model_validate(wallet)


@router.get("", response_model=Dict)
async def get_wallet(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    summary = await WalletService.get_wallet_summary(db, current_user.id)
    return {
        "wallet": MockWalletResponse.model_validate(summary["wallet"]),
        "positions": [
            MockPositionResponse.model_validate(pos) for pos in summary["positions"]
        ],
        "recent_orders": [
            MockOrderResponse.model_validate(order) for order in summary["recent_orders"]
        ]
    }


@router.post("/orders", response_model=MockOrderResponse, status_code=status.HTTP_201_CREATED)
async def place_order(
    order_data: MockOrderCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    order = await WalletService.place_mock_order(db, current_user.id, order_data)
    return MockOrderResponse.model_validate(order)
