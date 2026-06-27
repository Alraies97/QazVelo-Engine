import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError, BaseModel, Field
from typing import Optional
from app.core.config import settings
from app.schemas.analytics import AnalyticsCreate
from app.core.database import AsyncSessionLocal
from app.models.analytics import AnalyticsModel
from app.models.wallet import (
    MockWallet,
    MockPosition,
    MockOrder,
    OrderType,
    OrderSide,
    OrderStatus
)
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("QazVelo-Worker")


# Pydantic schema for price update messages
class PriceUpdate(BaseModel):
    asset_symbol: str = Field(..., description="Asset symbol (e.g., BTC, AAPL)")
    market_price: float = Field(..., gt=0.0, description="Current market price")
    extra_payload: Optional[dict] = Field(None)


async def process_analytics_message(session, data):
    validated_data = AnalyticsCreate(**data)
    logger.info(f"📥 Received and validated metric: {validated_data.metric_name}")
    db_obj = AnalyticsModel(
        metric_name=validated_data.metric_name,
        metric_value=validated_data.metric_value,
        user_id=validated_data.user_id,
        extra_payload=validated_data.extra_payload
    )
    session.add(db_obj)
    logger.info(f"💾 {validated_data.metric_name} saved successfully to database.")


async def process_price_update(session, asset_symbol: str, market_price: float):
    logger.info(f"📊 Processing price update for {asset_symbol} @ ${market_price:.2f}")

    # Find all matching pending limit orders
    result = await session.execute(
        select(MockOrder)
        .options(
            selectinload(MockOrder.wallet).selectinload(MockWallet.positions)
        )
        .where(
            MockOrder.asset_symbol == asset_symbol,
            MockOrder.order_type == OrderType.LIMIT,
            MockOrder.status == OrderStatus.PENDING,
            (
                (MockOrder.side == OrderSide.BUY) & (MockOrder.price >= market_price)
                | (MockOrder.side == OrderSide.SELL) & (MockOrder.price <= market_price)
            )
        )
    )
    matching_orders = result.scalars().all()

    logger.info(f"🎯 Found {len(matching_orders)} matching pending limit orders for {asset_symbol}")

    for order in matching_orders:
        wallet = order.wallet

        # Find existing position for asset
        existing_position = next(
            (pos for pos in wallet.positions if pos.asset_symbol == asset_symbol),
            None
        )

        # Execute the order
        order.status = OrderStatus.EXECUTED
        execution_price = market_price

        if order.side == OrderSide.BUY:
            total_cost = execution_price * order.quantity
            wallet.balance -= total_cost

            if existing_position:
                total_qty = existing_position.quantity + order.quantity
                total_val = (existing_position.quantity * existing_position.average_entry_price) + total_cost
                existing_position.average_entry_price = total_val / total_qty
                existing_position.quantity = total_qty
            else:
                new_pos = MockPosition(
                    wallet_id=wallet.id,
                    asset_symbol=asset_symbol,
                    quantity=order.quantity,
                    average_entry_price=execution_price
                )
                session.add(new_pos)

        elif order.side == OrderSide.SELL:
            total_revenue = execution_price * order.quantity
            wallet.balance += total_revenue

            if existing_position:
                if existing_position.quantity == order.quantity:
                    await session.delete(existing_position)
                else:
                    existing_position.quantity -= order.quantity

        logger.info(
            f"✅ Matched {order.side.value} LIMIT Order #{order.id} for {order.quantity} {asset_symbol} "
            f"@ market price ${execution_price:.2f}"
        )


async def process_message(msg_body: str):

    try:
        data = json.loads(msg_body)

        async with AsyncSessionLocal() as session:
            # Check if message is a price update (has asset_symbol and market_price)
            if "asset_symbol" in data and "market_price" in data:
                price_update = PriceUpdate(**data)
                await process_price_update(
                    session,
                    price_update.asset_symbol,
                    price_update.market_price
                )
            else:
                # Assume it's an analytics message
                await process_analytics_message(session, data)

            await session.commit()

    except json.JSONDecodeError:
        logger.error("❌ Failed to decode message body to JSON.")
    except ValidationError as e:
        logger.error(f"❌ Data validation failed: {e.errors()}")
    except Exception as e:
        logger.error(f"❌ Unexpected error during processing: {e}")

async def start_worker():
    
    consumer = AIOKafkaConsumer(
        "market_analytics",
        bootstrap_servers="localhost:9092",
        group_id="analytics_worker_group",
        auto_offset_reset="earliest" 
    )
    
    await consumer.start()
    logger.info("🚀 QazVelo-Worker is up and listening to 'market_analytics' topic...")
    
    try:
        async for msg in consumer:
            message_body = msg.value.decode("utf-8")
            await process_message(message_body)
    finally:
        await consumer.stop()
        logger.info("🔌 Worker stopped and disconnected from Kafka safely.")

if __name__ == "__main__":
    try:
        asyncio.run(start_worker())
    except KeyboardInterrupt:
        logger.info("👋 Worker interrupted by user. Exiting...")