import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from pydantic import ValidationError, BaseModel, Field
from typing import Optional
from datetime import datetime
from app.core.config import settings
from app.schemas.analytics import AnalyticsCreate
from app.core.database import AsyncSessionLocal
from app.models.analytics import AnalyticsModel
from app.models.alerts import PriceAlert, AlertCondition
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


async def process_price_update(session, producer, asset_symbol: str, market_price: float):
    logger.info(f"📊 Processing price update for {asset_symbol} @ ${market_price:.2f}")

    # Step 1: Process matching pending limit orders
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

    # Step 2: Process and trigger price alerts
    alert_result = await session.execute(
        select(PriceAlert)
        .where(
            PriceAlert.asset_symbol == asset_symbol,
            PriceAlert.is_active == True
        )
    )
    active_alerts = alert_result.scalars().all()
    logger.info(f"🔔 Found {len(active_alerts)} active price alerts for {asset_symbol}")

    for alert in active_alerts:
        triggered = False
        if alert.condition == AlertCondition.ABOVE and market_price >= alert.target_price:
            triggered = True
        elif alert.condition == AlertCondition.BELOW and market_price <= alert.target_price:
            triggered = True

        if triggered:
            # Update alert in DB
            alert.is_active = False
            alert.triggered_at = datetime.utcnow()

            # Publish notification to Kafka topic 'alerts_notifications'
            notification = {
                "user_id": alert.user_id,
                "asset_symbol": alert.asset_symbol,
                "target_price": alert.target_price,
                "trigger_price": market_price,
                "condition": alert.condition,
                "alert_id": alert.id
            }
            if producer:
                await producer.send_and_wait(
                    "alerts_notifications",
                    json.dumps(notification).encode("utf-8")
                )
                logger.info(
                    f"📤 Published alert notification for user {alert.user_id} "
                    f"on {asset_symbol} (triggered at ${market_price:.2f})"
                )
            else:
                logger.warning(
                    f"⚠️ Kafka producer not available, could not publish alert notification"
                )

            logger.info(
                f"🔔 Price Alert #{alert.id} triggered! {alert.asset_symbol} {alert.condition} "
                f"${alert.target_price:.2f} reached ${market_price:.2f}"
            )


async def process_message(session, producer, msg_body: str):
    try:
        data = json.loads(msg_body)

        # Check if message is a price update (has asset_symbol and market_price)
        if "asset_symbol" in data and "market_price" in data:
            price_update = PriceUpdate(**data)
            await process_price_update(
                session,
                producer,
                price_update.asset_symbol,
                price_update.market_price
            )
        else:
            # Assume it's an analytics message
            await process_analytics_message(session, data)

        await session.commit()

    except json.JSONDecodeError:
        await session.rollback()
        logger.error("❌ Failed to decode message body to JSON.")
    except ValidationError as e:
        await session.rollback()
        logger.error(f"❌ Data validation failed: {e.errors()}")
    except Exception as e:
        await session.rollback()
        logger.exception(f"❌ Unexpected error during processing: {e}")
        raise


async def start_worker():
    # Initialize Kafka consumer
    consumer = AIOKafkaConsumer(
        "market_analytics",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="analytics_worker_group",
        auto_offset_reset="earliest"
    )

    # Initialize Kafka producer for alerts notifications
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )

    await consumer.start()
    await producer.start()
    logger.info("🚀 QazVelo-Worker is up!")

    try:
        async for msg in consumer:
            message_body = msg.value.decode("utf-8")
            async with AsyncSessionLocal() as session:
                try:
                    await process_message(session, producer, message_body)
                except Exception:
                    logger.warning("⚠️ Message processing failed; continuing with next Kafka event.")
    finally:
        await consumer.stop()
        await producer.stop()
        logger.info("🔌 Worker stopped and disconnected from Kafka safely.")

if __name__ == "__main__":
    try:
        asyncio.run(start_worker())
    except KeyboardInterrupt:
        logger.info("👋 Worker interrupted by user. Exiting...")