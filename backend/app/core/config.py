from typing import List
from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated
import json


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

    SECRET_KEY: str = "super-secret-key-change-this-in-production-100-percent"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Allow all origins by default so the Replit proxy domain is always accepted
    ALLOWED_ORIGINS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]
    ALLOWED_HOSTS: Annotated[List[str], BeforeValidator(parse_list)] = ["*"]

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/qazvelo_db"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    REDIS_URL: str = "redis://localhost:6379"


settings = Settings()
