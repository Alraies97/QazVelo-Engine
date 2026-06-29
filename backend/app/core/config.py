from typing import List
from pydantic import BeforeValidator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated, Self
import json
import logging

logger = logging.getLogger("QazVelo-Config")

_INSECURE_DEFAULT_KEY = "super-secret-key-change-this-in-production-100-percent"


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

    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Allow all origins by default so the Replit proxy domain is always accepted
    ALLOWED_ORIGINS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]
    ALLOWED_HOSTS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/qazvelo_db"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    REDIS_URL: str = "redis://localhost:6379"

    @model_validator(mode="after")
    def validate_secrets(self) -> Self:
        if self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
            if self.ENVIRONMENT != "development":
                raise ValueError(
                    "SECRET_KEY must be set to a secure random value in non-development environments. "
                    "Set the SECRET_KEY environment variable or Replit secret before deploying."
                )
            logger.warning(
                "⚠️  Using default insecure SECRET_KEY — set SECRET_KEY env var before deploying to production."
            )
        return self


settings = Settings()
