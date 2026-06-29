from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
import logging
from app.models.wallet import (
    MockWallet,
    MockPosition,
    MockOrder,
    OrderType,
    OrderSide,
    OrderStatus
)
from app.schemas.wallet import MockOrderCreate

getcontext().prec = 28

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("QazVelo-Wallet-Service")


class WalletService:
    @staticmethod
    async def create_wallet(
        db: AsyncSession,
        user_id: int,
        initial_balance: float = 10000.0
    ) -> MockWallet:
        # Check if user already has a wallet
        result = await db.execute(select(MockWallet).where(MockWallet.user_id == user_id))
        existing_wallet = result.scalar_one_or_none()
        if existing_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has a mock wallet"
            )

        new_wallet = MockWallet(
            user_id=user_id,
            balance=initial_balance
        )
        db.add(new_wallet)
        await db.commit()
        await db.refresh(new_wallet)
        logger.info(f"✅ Created new mock wallet for user {user_id} with balance ${initial_balance}")
        return new_wallet

    @staticmethod
    async def get_wallet_summary(db: AsyncSession, user_id: int) -> Dict:
        # Get wallet with eager-loaded positions and orders
        result = await db.execute(
            select(MockWallet)
            .options(
                selectinload(MockWallet.positions),
                selectinload(MockWallet.orders)
            )
            .where(MockWallet.user_id == user_id)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mock wallet not found for user"
            )

        # Sort positions and orders
        positions_sorted = sorted(wallet.positions, key=lambda p: p.asset_symbol)
        recent_orders = sorted(wallet.orders, key=lambda o: o.created_at, reverse=True)[:10]

        return {
            "wallet": wallet,
            "positions": positions_sorted,
            "recent_orders": recent_orders
        }

    @staticmethod
    async def place_mock_order(
        db: AsyncSession,
        user_id: int,
        order_data: MockOrderCreate
    ) -> MockOrder:
        # Get wallet
        result = await db.execute(
            select(MockWallet)
            .options(selectinload(MockWallet.positions))
            .where(MockWallet.user_id == user_id)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mock wallet not found for user"
            )

        # Find existing position (if any)
        existing_position = next(
            (pos for pos in wallet.positions if pos.asset_symbol == order_data.asset_symbol),
            None
        )

        # Convert incoming numeric values to Decimal for precise accounting
        price = Decimal(str(order_data.price)) if order_data.price is not None else None
        quantity = Decimal(str(order_data.quantity))
        wallet_balance = Decimal(str(wallet.balance))
        existing_quantity = Decimal(str(existing_position.quantity)) if existing_position else Decimal("0")

        # Risk Management Checks
        if order_data.side == OrderSide.BUY:
            if order_data.order_type == OrderType.MARKET and price is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Market orders require current price for calculation"
                )
            if order_data.order_type == OrderType.LIMIT and price is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Limit orders require a price"
                )

            total_cost = price * quantity
            if wallet_balance < total_cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance: need ${total_cost:.2f}, have ${wallet_balance:.2f}"
                )

        elif order_data.side == OrderSide.SELL:
            if existing_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient position quantity: need {quantity} {order_data.asset_symbol}, have {existing_quantity}"
                )

        # Create order
        new_order = MockOrder(
            wallet_id=wallet.id,
            asset_symbol=order_data.asset_symbol,
            order_type=order_data.order_type,
            side=order_data.side,
            price=price,
            quantity=quantity,
            status=OrderStatus.PENDING
        )

        new_order = MockOrder(
            wallet_id=wallet.id,
            asset_symbol=order_data.asset_symbol,
            order_type=order_data.order_type,
            side=order_data.side,
            price=price,
            quantity=quantity,
            status=OrderStatus.PENDING
        )

        async with db.begin():
            db.add(new_order)

            # Execute Market Orders immediately
            if order_data.order_type == OrderType.MARKET:
                new_order.status = OrderStatus.EXECUTED

                if order_data.side == OrderSide.BUY:
                    total_cost = (price * quantity).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
                    wallet.balance = float((wallet_balance - total_cost).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP))

                    if existing_position:
                        existing_qty = Decimal(str(existing_position.quantity))
                        total_quantity = existing_qty + quantity
                        total_value = (existing_qty * Decimal(str(existing_position.average_entry_price))) + total_cost
                        existing_position.average_entry_price = float((total_value / total_quantity).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP))
                        existing_position.quantity = float(total_quantity)
                    else:
                        new_position = MockPosition(
                            wallet_id=wallet.id,
                            asset_symbol=order_data.asset_symbol,
                            quantity=float(quantity),
                            average_entry_price=float(price)
                        )
                        db.add(new_position)

                elif order_data.side == OrderSide.SELL:
                    total_revenue = (price * quantity).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
                    wallet.balance = float((wallet_balance + total_revenue).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP))

                    if existing_position and Decimal(str(existing_position.quantity)) == quantity:
                        await db.delete(existing_position)
                    elif existing_position:
                        remaining_qty = Decimal(str(existing_position.quantity)) - quantity
                        existing_position.quantity = float(remaining_qty)

                    logger.info(
                        f"✅ Executed MARKET {order_data.side.value} order for {quantity} {order_data.asset_symbol} @ ${price}"
                    )

        await db.refresh(new_order)
        return new_order
