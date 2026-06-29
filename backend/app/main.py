from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
import uvicorn

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
from app.core.cache import init_redis_from_env, get_redis_client
from app.services.market_data import MarketDataService
from app.models.users import UserModel
from app.models.analytics import AnalyticsModel
from app.models.wallet import MockWallet, MockPosition, MockOrder
from app.models.alerts import PriceAlert

logger = logging.getLogger("QazVelo-Startup")

# Tickers whose price history is prefetched into Redis on every boot.
# Must stay in sync with the ASSETS list in the React frontend.
_PREFETCH_TICKERS = [
    ("BTC-USD", "1mo"),
    ("ETH-USD", "1mo"),
    ("AAPL",    "1mo"),
]


async def _warm_startup_cache() -> None:
    """Fetch historical prices for all frontend tickers concurrently and
    write them into Redis so the very first user request is served from cache."""
    logger.info("🔥 [QazVelo-Cache] Starting startup cache warm for %d tickers…", len(_PREFETCH_TICKERS))

    async def _warm_one(ticker: str, period: str) -> None:
        try:
            prices = await MarketDataService.get_historical_price(ticker, period)
            if prices:
                await MarketDataService.warm_cache(ticker, period)
                logger.info("✅ [QazVelo-Cache] Warmed %s (%s) — %d points", ticker, period, len(prices))
            else:
                logger.warning("⚠️  [QazVelo-Cache] No data for %s (%s) — skipped", ticker, period)
        except Exception as exc:
            logger.warning("⚠️  [QazVelo-Cache] Failed to warm %s: %s", ticker, exc)

    await asyncio.gather(*[_warm_one(t, p) for t, p in _PREFETCH_TICKERS])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Database ──────────────────────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("🗄️  [QazVelo-Engine] Database tables created successfully!")

    # ── Redis / fakeredis ─────────────────────────────────────────────────────
    # init_redis_from_env() selects real Redis (prod) or fakeredis (dev) based
    # on REDIS_URL and ENVIRONMENT env vars, and registers the singleton via
    # cache.set_redis_client() so get_redis_client() works everywhere.
    redis_client = await init_redis_from_env()
    if redis_client is not None:
        try:
            await FastAPILimiter.init(redis_client)
            print("✅ [QazVelo-Engine] Rate limiter initialized")
        except Exception as exc:
            print(f"⚠️  [QazVelo-Engine] Rate limiter init failed (non-fatal): {exc}")

    # ── Startup cache warm (background — does not block server ready) ─────────
    asyncio.create_task(_warm_startup_cache())
    print("🔥 [QazVelo-Engine] Cache warm-up task scheduled (BTC-USD, ETH-USD, AAPL)")

    # ── Binance market streams ────────────────────────────────────────────────
    await start_all_streams()
    print("📡 [QazVelo-Engine] Binance market streams started (BTC, ETH)")

    # ── Kafka producer (optional — graceful degradation if broker absent) ─────
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

    # ── Shutdown ──────────────────────────────────────────────────────────────
    await stop_all_streams()
    if getattr(app.state, "kafka_producer", None):
        await app.state.kafka_producer.stop()
    redis = get_redis_client()
    if redis is not None:
        try:
            await redis.aclose()
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
    import os
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=settings.DEBUG,
        reload_dirs=["app"] if settings.DEBUG else None,
    )
