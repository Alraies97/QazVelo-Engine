"""
Thin singleton wrapper around the Redis/fakeredis client.

The lifespan in main.py calls `set_redis_client()` once the client is ready.
Any module (e.g. MarketDataService) imports `get_redis_client()` to obtain it.
This avoids circular imports and keeps the client out of app.state so services
can use it without needing a Request object.
"""

from typing import Any, Optional

_redis_client: Optional[Any] = None


def set_redis_client(client: Any) -> None:
    global _redis_client
    _redis_client = client


def get_redis_client() -> Optional[Any]:
    return _redis_client
