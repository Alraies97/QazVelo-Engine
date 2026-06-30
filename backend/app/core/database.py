from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import URL
from app.core.config import settings
import urllib.parse

def _make_async_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    # Remove sslmode query param (asyncpg uses ssl= connect_arg instead)
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    params.pop("sslmode", None)
    new_query = urllib.parse.urlencode({k: v[0] for k, v in params.items()})
    url = parsed._replace(query=new_query).geturl()
    return url

_async_url = _make_async_url(settings.DATABASE_URL)

engine = create_async_engine(
   _async_url,
    echo=False,
    connect_args={"ssl": False}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
