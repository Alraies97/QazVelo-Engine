"""
Redis/fakeredis singleton for the QazVelo backend.

Initialization strategy (checked in order):
  1. ENVIRONMENT=production  → must connect to real Redis via REDIS_URL; raises if it fails.
  2. ENVIRONMENT=development + REDIS_URL reachable → use real Redis (local Docker, etc.).
  3. Fallback → in-process fakeredis (zero config, safe for dev / Replit free tier).

Callers:
  - main.py lifespan: await init_redis_from_env()  (registers the singleton + returns client)
  - anywhere else:    get_redis_client()            (returns the registered singleton)
"""

import logging
import os
from typing import Any, Optional

logger = logging.getLogger("QazVelo-Cache")

_redis_client: Optional[Any] = None


# ── Public accessors ──────────────────────────────────────────────────────────

def set_redis_client(client: Any) -> None:
    global _redis_client
    _redis_client = client


def get_redis_client() -> Optional[Any]:
    return _redis_client


# ── Initializer (called once at startup) ─────────────────────────────────────

async def init_redis_from_env() -> Optional[Any]:
    """
    Build the Redis client from environment variables, register it, and return it.

    Environment variables:
      REDIS_URL   — Redis connection string (default: redis://localhost:6379)
      ENVIRONMENT — "production" | "development" (default: "development")

    Returns the connected client (real Redis or fakeredis), or None on failure.
    """
    global _redis_client

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    environment = os.getenv("ENVIRONMENT", "development")

    # ── 1. Try real Redis ─────────────────────────────────────────────────────
    try:
        import redis.asyncio as aioredis  # type: ignore[import]

        # Upstash / TLS URLs start with rediss://
        client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        await client.ping()

        safe_url = redis_url.split("@")[-1]  # strip credentials from log
        logger.info("✅ [Redis] Connected: %s (env=%s)", safe_url, environment)
        _redis_client = client
        return client

    except Exception as exc:
        if environment == "production":
            # In production a missing/broken Redis is fatal — surface immediately.
            raise RuntimeError(
                f"Production Redis connection failed. "
                f"Check the REDIS_URL secret. Error: {exc}"
            ) from exc

        logger.warning(
            "⚠️  [Redis] Unavailable (%s) — falling back to in-process fakeredis.", exc
        )

    # ── 2. Development fallback: fakeredis ────────────────────────────────────
    try:
        import fakeredis.aioredis as fakeredis_async  # type: ignore[import]

        fake = fakeredis_async.FakeRedis(decode_responses=True)
        logger.info("✅ [Redis] fakeredis initialized (development / Replit mode)")
        _redis_client = fake
        return fake

    except Exception as fe:
        logger.error("❌ [Redis] fakeredis also failed: %s — rate limiting disabled", fe)
        _redis_client = None
        return None
