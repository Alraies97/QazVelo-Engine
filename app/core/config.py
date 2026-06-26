from typing import List, Any 
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


class Settings(BaseSettings):
    model_config=SettingsConfigDict(
        env_file=".env",
        extra="ignore"
        )

    APP_NAME: str="QazVelo-Engine"
    ENVIRONMENT: str="development"
    DEBUG: bool=True
    API_V1_STR: str="/api/v1"


    SECRET_KEY: str="super-secret-key-change-this-in-production-100-percent"
    ALGORITHM: str="HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int=60

    ALLOWED_ORIGINS: List[str]=["*"]
    ALLOWED_HOSTS: List[str]=["*"]

    DATABASE_URL: str = "postgresql+asyncpg://postgres:1234@localhost:5432/qazvelo_db"
    KAFKA_BOOTSTRAP_SERVERS: str="localhost:9092"
    REDIS_URL: str="redis://localhost:6379"

settings=Settings()
