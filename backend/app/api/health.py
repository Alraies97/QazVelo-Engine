"""
GET /api/v1/health — Deep health check endpoint.

Concurrently probes:
  • Redis        — ping() with a 2 s timeout
  • Database     — SELECT 1 with a 2 s timeout
  • Binance streams — synchronous inspection of the task registry (no I/O)

Response shape
--------------
{
  "status": "healthy" | "degraded" | "unhealthy",
  "environment": "development",
  "version": "0.1.0",
  "timestamp": "<ISO-8601>",
  "checks": {
    "redis":           { "status": "ok"|"error", "latency_ms": float, "detail": str },
    "database":        { "status": "ok"|"error", "latency_ms": float, "detail": str },
    "binance_streams": { "status": "ok"|"degraded"|"down",
                         "active": [...], "expected": int, "detail": str }
  }
}

HTTP codes
----------
  200  healthy / degraded  (app can serve requests)
  503  unhealthy           (Redis or DB unreachable — critical)

Keep this endpoint unauthenticated so load-balancers and Docker HEALTHCHECK can
reach it without a JWT token.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.cache import get_redis_client
from app.core.database import AsyncSessionLocal

router = APIRouter(tags=["Health"])

_EXPECTED_STREAMS = 2          # BTC + ETH (see binance.start_all_streams)
_PROBE_TIMEOUT   = 2.0         # seconds per probe before declaring failure
_VERSION         = "0.1.0"


# ── Individual probes ─────────────────────────────────────────────────────────

async def _check_redis() -> dict[str, Any]:
    client = get_redis_client()
    if client is None:
        return {"status": "error", "latency_ms": None, "detail": "client not initialised"}

    # Distinguish real Redis from fakeredis for the detail message.
    client_type = type(client).__module__
    is_fake = "fakeredis" in client_type

    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(client.ping(), timeout=_PROBE_TIMEOUT)
        latency = round((time.perf_counter() - t0) * 1000, 2)
        detail = "fakeredis (development mode)" if is_fake else "connected"
        return {"status": "ok", "latency_ms": latency, "detail": detail}
    except Exception as exc:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {"status": "error", "latency_ms": latency, "detail": str(exc)}


async def _check_database() -> dict[str, Any]:
    t0 = time.perf_counter()
    try:
        async def _probe() -> None:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))

        await asyncio.wait_for(_probe(), timeout=_PROBE_TIMEOUT)
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {"status": "ok", "latency_ms": latency, "detail": "reachable"}
    except Exception as exc:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {"status": "error", "latency_ms": latency, "detail": str(exc)}


def _check_binance_streams() -> dict[str, Any]:
    # Import here to avoid a circular-import at module load time.
    from app.api.binance import _stream_tasks  # type: ignore[attr-defined]

    active_names = [t.get_name() for t in _stream_tasks if not t.done()]
    active_symbols = [
        n.replace("binance-stream-", "").upper() for n in active_names
    ]
    count = len(active_symbols)

    if count == _EXPECTED_STREAMS:
        status = "ok"
        detail = f"{count}/{_EXPECTED_STREAMS} streams running"
    elif count > 0:
        status = "degraded"
        detail = f"only {count}/{_EXPECTED_STREAMS} streams running"
    else:
        status = "down"
        detail = "no streams active"

    return {
        "status": status,
        "active": active_symbols,
        "expected": _EXPECTED_STREAMS,
        "detail": detail,
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/health", summary="Deep health check")
async def health_check() -> JSONResponse:
    from app.core.config import settings  # local import — avoids module-level cycle

    # Run I/O probes concurrently; Binance check is synchronous.
    redis_result, db_result = await asyncio.gather(
        _check_redis(),
        _check_database(),
    )
    binance_result = _check_binance_streams()

    checks = {
        "redis":           redis_result,
        "database":        db_result,
        "binance_streams": binance_result,
    }

    # Overall status classification
    critical_ok = redis_result["status"] == "ok" and db_result["status"] == "ok"
    streams_ok  = binance_result["status"] == "ok"

    if critical_ok and streams_ok:
        overall = "healthy"
    elif critical_ok:
        overall = "degraded"      # streams down, but app can still serve requests
    else:
        overall = "unhealthy"     # DB or Redis unreachable — critical

    http_status = 200 if overall in ("healthy", "degraded") else 503

    body = {
        "status":      overall,
        "environment": settings.ENVIRONMENT,
        "version":     _VERSION,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "checks":      checks,
    }

    return JSONResponse(content=body, status_code=http_status)
