import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError
from app.core.config import settings
from app.schemas.analytics import AnalyticsCreate
from app.core.database import AsyncSessionLocal
from app.models.analytics import AnalyticsModel
from app.models.users import UserModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("QazVelo-Worker")

async def process_message(msg_body: str):

    try:
        data = json.loads(msg_body)        
    
        validated_data = AnalyticsCreate(**data)
        logger.info(f"📥 Received and validated metric: {validated_data.metric_name}")

        async with AsyncSessionLocal() as session:
            db_obj = AnalyticsModel(
                metric_name=validated_data.metric_name,
                metric_value=validated_data.metric_value,
                user_id=validated_data.user_id,
                extra_payload=validated_data.extra_payload
            )
            session.add(db_obj)
            await session.commit()
            
        logger.info(f"💾 {validated_data.metric_name} saved successfully to database.")
        

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