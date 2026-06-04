from typing import List
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


def parse_cors_origins(v: repr)->List[str]:
    if isinstance(v, str):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list):
        return v
    raise []

class Settings(BaseSettings):
    model_config=SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore"
        )

    APP_NAME: str="QazVelo-Engine"
    ENVIRONMENT: str="development"
    DEBUG: bool=True
    API_V1_STR: str="/api/v1"


    SECRET_KEY: str="super-secret-key-change-this-in-production-100-percent"
    ALGORITHM: str="HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int=60

    ALLOWED_ORIGINS: Annotated[List[str], BeforeValidator(parse_cors_origins)] = [

        "http://localhost:3000"
    ]
    ALLOWED_HOSTS: Annotated[List[str], BeforeValidator(parse_cors_origins)] = [
        "localhost", "127.0.0.1"
    ]

    DATABASE_URL: str="postgresql+asyncpg://postgres:postgres@localhost:5432/QazVelo_db"
    KAFKA_BOOTSTRAP_SERVERS: str="localhost:9092"
    REDIS_URL: str="redis://localhost:6379/0"

settings=Settings()

