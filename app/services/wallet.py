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

        # Risk Management Checks
        if order_data.side == OrderSide.BUY:
            if order_data.order_type == OrderType.MARKET and not order_data.price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Market orders require current price for calculation"
                )
            if order_data.order_type == OrderType.LIMIT and not order_data.price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Limit orders require a price"
                )

            total_cost = order_data.price * order_data.quantity
            if wallet.balance < total_cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance: need ${total_cost:.2f}, have ${wallet.balance:.2f}"
                )

        elif order_data.side == OrderSide.SELL:
            if not existing_position or existing_position.quantity < order_data.quantity:
                available = existing_position.quantity if existing_position else 0.0
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient position quantity: need {order_data.quantity} {order_data.asset_symbol}, have {available}"
                )

        # Create order
        new_order = MockOrder(
            wallet_id=wallet.id,
            asset_symbol=order_data.asset_symbol,
            order_type=order_data.order_type,
            side=order_data.side,
            price=order_data.price,
            quantity=order_data.quantity,
            status=OrderStatus.PENDING
        )
        db.add(new_order)

        # Execute Market Orders immediately
        if order_data.order_type == OrderType.MARKET:
            new_order.status = OrderStatus.EXECUTED

            if order_data.side == OrderSide.BUY:
                # Update balance
                total_cost = order_data.price * order_data.quantity
                wallet.balance -= total_cost

                # Update position
                if existing_position:
                    # Calculate new average entry price
                    total_quantity = existing_position.quantity + order_data.quantity
                    total_value = (existing_position.quantity * existing_position.average_entry_price) + total_cost
                    existing_position.average_entry_price = total_value / total_quantity
                    existing_position.quantity = total_quantity
                else:
                    # Create new position
                    new_position = MockPosition(
                        wallet_id=wallet.id,
                        asset_symbol=order_data.asset_symbol,
                        quantity=order_data.quantity,
                        average_entry_price=order_data.price
                    )
                    db.add(new_position)

            elif order_data.side == OrderSide.SELL:
                # Update balance
                total_revenue = order_data.price * order_data.quantity
                wallet.balance += total_revenue

                # Update/remove position
                if existing_position.quantity == order_data.quantity:
                    await db.delete(existing_position)
                else:
                    existing_position.quantity -= order_data.quantity

            logger.info(f"✅ Executed MARKET {order_data.side.value} order for {order_data.quantity} {order_data.asset_symbol} @ ${order_data.price}")

        await db.commit()
        await db.refresh(new_order)
        return new_order
