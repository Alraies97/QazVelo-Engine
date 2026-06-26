from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import uvicorn
import redis.asyncio as aioredis
from fastapi_limiter import FastAPILimiter
from app.core.config import settings
from app.api.analytics import router as analytics_router
from app.api.ws_analytics import router as ws_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.database import engine, Base
from app.models.users import UserModel
from app.models.analytics import AnalyticsModel
from app.api import users
from aiokafka import AIOKafkaProducer
import json

kafka_producer: AIOKafkaProducer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    await FastAPILimiter.init(redis_client)

    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8') 
    )

    await producer.start()
    app.state.kafka_producer = producer
    print("🚀 [QazVelo-Engine] Kafka Producer started successfully!")
    yield
    
    await producer.stop()
    await redis_client.close()
    print("🛑 [QazVelo-Engine] Services stopped cleanly.")

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])

app = FastAPI(
    title=settings.APP_NAME,
    description=" High-Performance Real-Time Market Analytics Engine | QazVelo-Engine",
    version="0.1.0",
    debug=settings.DEBUG,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


app.include_router(analytics_router)
app.include_router(ws_router)
app.include_router(auth_router)
app.include_router(users_router)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/",tags=["Health"])
async def root_health_check():
    return {
        "status": "online",
        "engine": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.DEBUG
        )



    