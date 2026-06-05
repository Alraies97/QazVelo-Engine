from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
from app.core.config import settings
from app.api.analytics import router as analytics_router
from app.api.ws_analytics import router as ws_router


app = FastAPI(
    title=settings.APP_NAME,
    description=" High-Performance Real-Time Market Analytics Engine | QazVelo-Engine",
    version="0.1.0",
    debug=settings.DEBUG,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
)

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

app.include_router(analytics_router)
app.include_router(ws_router)

@app.get("/")
def root():
    return {"message": "Welcome to QazVelo-Engine - Real-Time Market Analytics API"}
    