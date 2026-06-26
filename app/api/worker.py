import asyncio
from aiokafka import AIOKafkaConsumer
import json
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.analytics import AnalyticsModel 

async def run_worker():
    consumer = AIOKafkaConsumer(
        "market_analytics",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="analytics_processors", # اسم المجموعة المعالجة
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    
    await consumer.start()
    print("⚙️ [Background Worker] Listening for live market events from Kafka...")
    
    try:
        async for msg in consumer:
            payload = msg.value
            print(f"📥 Worker Received Data: {payload}")
            
            async with AsyncSessionLocal() as db_session:
                try:
                    db_entry = AnalyticsModel(
                        symbol=payload.get("symbol", "UNKNOWN"),
                        price=payload.get("price", 0.0),
                        volume=payload.get("volume", 0.0)
                    )
                    db_session.add(db_entry)
                    await db_session.commit()
                    print("💾 Data successfully persisted to PostgreSQL by the worker.")
                except Exception as db_err:
                    await db_session.rollback()
                    print(f"❌ Worker DB Error: {db_err}")
                    
    finally:
        await consumer.stop()

if __name__ == "__main__":
    asyncio.run(run_worker())