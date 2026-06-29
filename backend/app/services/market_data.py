import asyncio
import json
import logging
import threading
from typing import List, Optional

import yfinance as yf

from app.core.cache import get_redis_client

# yfinance uses an internal SQLite cache that raises "database is locked" when
# multiple threads write to it simultaneously.  This lock serialises all
# yfinance calls so only one thread touches SQLite at a time.
_yfinance_lock = threading.Lock()

logger = logging.getLogger("QazVelo-MarketData")

_CACHE_TTL_SECONDS = 180  # 3-minute TTL for price history


def _cache_key(ticker: str, period: str) -> str:
    return f"market_data:prices:{ticker}:{period}"


class MarketDataService:
    @staticmethod
    def _fetch_historical_price(ticker: str, period: str = "1mo") -> Optional[List[float]]:
        with _yfinance_lock:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period=period)
                if hist.empty:
                    return None
                return hist["Close"].dropna().tolist()
            except Exception as exc:
                logger.warning("yfinance fetch failed for %s (%s): %s", ticker, period, exc)
                return None

    @staticmethod
    async def get_historical_price(ticker: str, period: str = "1mo") -> Optional[List[float]]:
        redis = get_redis_client()
        key = _cache_key(ticker, period)

        # ── 1. Try Redis cache first ──────────────────────────────────────────
        if redis is not None:
            try:
                cached = await redis.get(key)
                if cached:
                    prices: List[float] = json.loads(cached)
                    logger.debug("Cache HIT for %s (%s) — %d points", ticker, period, len(prices))
                    return prices
            except Exception as exc:
                logger.warning("Redis GET failed, falling through to fetch: %s", exc)

        # ── 2. Fetch from yfinance ────────────────────────────────────────────
        prices = await asyncio.to_thread(MarketDataService._fetch_historical_price, ticker, period)

        if prices is not None and len(prices) > 0:
            # ── 3. Write back to cache ────────────────────────────────────────
            if redis is not None:
                try:
                    await redis.setex(key, _CACHE_TTL_SECONDS, json.dumps(prices))
                    logger.debug("Cache SET for %s (%s) TTL=%ds", ticker, period, _CACHE_TTL_SECONDS)
                except Exception as exc:
                    logger.warning("Redis SETEX failed (non-fatal): %s", exc)
            return prices

        # ── 4. Fetch failed — return stale cache rather than nothing ─────────
        if redis is not None:
            try:
                # Try without TTL check (stale-if-error pattern)
                stale_key = f"{key}:stale"
                stale = await redis.get(stale_key)
                if stale:
                    prices = json.loads(stale)
                    logger.warning(
                        "yfinance unavailable for %s — serving stale cache (%d points)",
                        ticker, len(prices),
                    )
                    return prices
            except Exception as exc:
                logger.warning("Redis stale-cache GET failed: %s", exc)

        logger.warning("No price data available for %s (%s) — will use fallback stub", ticker, period)
        return None

    @staticmethod
    async def warm_cache(ticker: str, period: str = "1mo") -> None:
        """Write a long-lived stale-cache entry alongside the normal TTL entry.

        Called after a successful fetch so the stale-if-error fallback always
        has something to return even when the live TTL entry has expired.
        """
        redis = get_redis_client()
        if redis is None:
            return
        prices = await MarketDataService.get_historical_price(ticker, period)
        if prices:
            stale_key = f"{_cache_key(ticker, period)}:stale"
            try:
                # Keep stale for 24 h — only used when live fetch fails
                await redis.setex(stale_key, 86_400, json.dumps(prices))
            except Exception as exc:
                logger.warning("Redis stale warm failed: %s", exc)
