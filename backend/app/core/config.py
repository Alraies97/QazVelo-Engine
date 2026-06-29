from typing import List
from pydantic import BeforeValidator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated, Self
import json
import logging

logger = logging.getLogger("QazVelo-Config")

_INSECURE_DEFAULT_KEY = ""  # empty string → validator always rejects it in production


def parse_list(v: str | List[str]) -> List[str]:
    if isinstance(v, list):
        return v
    try:
        return json.loads(v)
    except (json.JSONDecodeError, TypeError):
        return [x.strip() for x in v.split(",") if x.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    APP_NAME: str = "QazVelo-Engine"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = ""  # must be set via env var / run.py bootstrap; never hardcoded
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Allow all origins by default so the Replit proxy domain is always accepted
    ALLOWED_ORIGINS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]
    ALLOWED_HOSTS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/qazvelo_db"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    REDIS_URL: str = "redis://localhost:6379"

    # ── Binance Exchange Integration ──────────────────────────────────────────
    # Set these in Replit Secrets (never in .env or committed config).
    # Leave empty to stay in paper-trading mode (default / safe).
    #
    # BINANCE_TESTNET=true  → connects to testnet.binance.vision (no real funds)
    # BINANCE_TESTNET=false → connects to api.binance.com  (USE WITH CAUTION)
    #
    # ENABLE_BINANCE_LIVE_TRADING is the master kill-switch.
    # It must be explicitly set to True before any order is forwarded to Binance.
    # ─────────────────────────────────────────────────────────────────────────
    BINANCE_API_KEY: str = ""
    BINANCE_SECRET_KEY: str = ""
    BINANCE_TESTNET: bool = True
    ENABLE_BINANCE_LIVE_TRADING: bool = False

    @model_validator(mode="after")
    def validate_secrets(self) -> Self:
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            if self.ENVIRONMENT != "development":
                raise ValueError(
                    "SECRET_KEY must be set to a secure random value (≥32 chars) in non-development "
                    "environments. Set it via the SECRET_KEY Replit Secret before deploying."
                )
            logger.warning(
                "⚠️  SECRET_KEY is empty or too short. "
                "Set SECRET_KEY env var or run via run.py which auto-generates one."
            )
        return self


settings = Settings()
