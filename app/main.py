from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import uvicorn
import redis.asyncio as redis
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.analytics import router as analytics_router
from app.api.ws_analytics import router as ws_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_instance = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    await FastAPILimiter.init(redis_instance)
    yield
    await FastAPILimiter.close()
    await redis_instance.close()


app = FastAPI(
    title=settings.APP_NAME,
    description=" High-Performance Real-Time Market Analytics Engine | QazVelo-Engine",
    version="0.1.0",
    debug=settings.DEBUG,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )

app.include_router(analytics_router)
app.include_router(ws_router)
app.include_router(auth_router)
app.include_router(users_router)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
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



@app.get("/")
def root():
    return {"message": "Welcome to QazVelo-Engine - Real-Time Market Analytics API"}
    