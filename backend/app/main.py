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
from app.api.wallet import router as wallet_router
from app.api.alerts import router as alerts_router
from app.api.binance import router as binance_router, start_all_streams, stop_all_streams
from app.api.ws_market import router as ws_market_router
from app.core.database import engine, Base
from app.core.cache import set_redis_client
from app.models.users import UserModel
from app.models.analytics import AnalyticsModel
from app.models.wallet import MockWallet, MockPosition, MockOrder
from app.models.alerts import PriceAlert
import json

_redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _redis_client

    # Create all database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("🗄️ [QazVelo-Engine] Database tables created successfully!")

    # Initialize Redis for rate limiting (fall back to fakeredis if unavailable)
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
        await redis_client.ping()
        await FastAPILimiter.init(redis_client)
        _redis_client = redis_client
        set_redis_client(redis_client)
        print("✅ [QazVelo-Engine] Redis rate limiter initialized")
    except Exception as exc:
        print(f"⚠️  [QazVelo-Engine] Redis unavailable ({exc}), using in-memory fallback")
        try:
            import fakeredis.aioredis as fakeredis_async
            # lupa being installed enables Lua scripting in fakeredis automatically
            fake = fakeredis_async.FakeRedis(decode_responses=True)
            await FastAPILimiter.init(fake)
            _redis_client = fake
            set_redis_client(fake)
            print("✅ [QazVelo-Engine] fakeredis rate limiter initialized (dev mode)")
        except Exception as fe:
            print(f"⚠️  [QazVelo-Engine] Could not init rate limiter: {fe}")
            _redis_client = None

    # Start Binance live price streams (public — no API key required for market data)
    await start_all_streams()
    print("📡 [QazVelo-Engine] Binance market streams started (BTC, ETH)")

    # Start Kafka producer (optional — graceful degradation when broker is absent)
    try:
        from aiokafka import AIOKafkaProducer
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        await producer.start()
        app.state.kafka_producer = producer
        print("🚀 [QazVelo-Engine] Kafka Producer started successfully!")
    except Exception as exc:
        print(
            f"⚠️  [QazVelo-Engine] Kafka unavailable ({exc}), "
            "analytics WS will persist directly to DB"
        )
        app.state.kafka_producer = None

    yield

    await stop_all_streams()
    if getattr(app.state, "kafka_producer", None):
        await app.state.kafka_producer.stop()
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
    print("🛑 [QazVelo-Engine] Services stopped cleanly.")


app = FastAPI(
    title=settings.APP_NAME,
    description="High-Performance Real-Time Market Analytics Engine | QazVelo-Engine",
    version="0.1.0",
    debug=settings.DEBUG,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(ws_router,        prefix=settings.API_V1_STR)
app.include_router(auth_router,      prefix=settings.API_V1_STR)
app.include_router(users_router,     prefix=settings.API_V1_STR)
app.include_router(wallet_router,    prefix=settings.API_V1_STR)
app.include_router(alerts_router,    prefix=settings.API_V1_STR)
app.include_router(binance_router,   prefix=settings.API_V1_STR)
app.include_router(ws_market_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def root_health_check():
    return {
        "status": "online",
        "engine": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="localhost",
        port=8000,
        reload=settings.DEBUG,
    )
