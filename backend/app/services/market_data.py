import asyncio
import json
import logging
import math
import random
import threading
import time
from typing import List, Optional

import yfinance as yf

from app.core.cache import get_redis_client

# yfinance uses an internal SQLite cache that raises "database is locked" when
# multiple threads write to it simultaneously.  This lock serialises all
# yfinance calls so only one thread touches SQLite at a time.
_yfinance_lock = threading.Lock()

logger = logging.getLogger("QazVelo-MarketData")

_CACHE_TTL_SECONDS  = 180   # 3-minute TTL for live price history
_STALE_TTL_SECONDS  = 86_400  # 24-hour TTL for stale-if-error fallback
_FETCH_RETRIES      = 2     # yfinance attempts before giving up
_RETRY_BACKOFF_S    = 0.3   # delay multiplier per retry  (0.3s, 0.6s)

# Approximate mid-price ranges used to seed synthetic data.
# Synthetic data is only generated when yfinance is unavailable AND Redis has
# nothing — it keeps the UI functional during Yahoo Finance outages / rate-limits.
_SYNTHETIC_RANGES: dict[str, tuple[float, float]] = {
    "BTC-USD":  (60_000, 110_000),
    "ETH-USD":  (2_000,   4_500),
    "AAPL":     (170,     230),
    "GOOGL":    (150,     200),
    "MSFT":     (380,     460),
    "TSLA":     (150,     280),
    "SOL-USD":  (120,     220),
    "BNB-USD":  (280,     650),
    "DEFAULT":  (100,     200),
}


def _cache_key(ticker: str, period: str) -> str:
    return f"market_data:prices:{ticker}:{period}"


def _stale_key(ticker: str, period: str) -> str:
    return f"{_cache_key(ticker, period)}:stale"


def _generate_synthetic_prices(ticker: str, n_points: int = 30) -> List[float]:
    """
    Geometric Brownian Motion price series for when Yahoo Finance is unavailable.

    This is a dev/fallback path only — clearly marked as synthetic in logs.
    The component already shows a "Simulated" badge for live ticks; the
    historical baseline being synthetic is acceptable in a degraded state.
    """
    lo, hi = _SYNTHETIC_RANGES.get(ticker, _SYNTHETIC_RANGES["DEFAULT"])
    start = (lo + hi) / 2 * (0.9 + random.random() * 0.2)  # ±10% around mid
    drift = 0.0002
    sigma = 0.018
    prices = [start]
    for _ in range(n_points - 1):
        shock = random.gauss(drift, sigma)
        prices.append(max(lo * 0.4, prices[-1] * math.exp(shock)))
    return [round(p, 4) for p in prices]


class MarketDataService:

    @staticmethod
    def _fetch_historical_price(ticker: str, period: str = "1mo") -> Optional[List[float]]:
        """
        Synchronous yfinance fetch, serialised by _yfinance_lock to prevent
        SQLite contention.  Retries up to _FETCH_RETRIES times with linear
        backoff before returning None.
        """
        with _yfinance_lock:
            for attempt in range(1, _FETCH_RETRIES + 1):
                try:
                    stock = yf.Ticker(ticker)
                    hist = stock.history(period=period)
                    if not hist.empty:
                        prices = hist["Close"].dropna().tolist()
                        if prices:
                            return prices
                    logger.warning(
                        "yfinance returned empty history for %s/%s (attempt %d/%d)",
                        ticker, period, attempt, _FETCH_RETRIES,
                    )
                except Exception as exc:
                    logger.warning(
                        "yfinance fetch failed for %s/%s (attempt %d/%d): %s",
                        ticker, period, attempt, _FETCH_RETRIES, exc,
                    )
                if attempt < _FETCH_RETRIES:
                    time.sleep(_RETRY_BACKOFF_S * attempt)
            return None

    @staticmethod
    async def get_historical_price(
        ticker: str,
        period: str = "1mo",
        allow_synthetic: bool = True,
    ) -> Optional[List[float]]:
        redis = get_redis_client()
        key   = _cache_key(ticker, period)

        # ── 1. Redis hot cache ────────────────────────────────────────────────
        if redis is not None:
            try:
                cached = await redis.get(key)
                if cached:
                    prices: List[float] = json.loads(cached)
                    logger.debug("Cache HIT %s/%s — %d pts", ticker, period, len(prices))
                    return prices
            except Exception as exc:
                logger.warning("Redis GET failed, falling through: %s", exc)

        # ── 2. Live yfinance fetch (with retries) ─────────────────────────────
        prices = await asyncio.to_thread(
            MarketDataService._fetch_historical_price, ticker, period
        )

        if prices:
            # Write hot cache + stale-if-error entry concurrently.
            if redis is not None:
                try:
                    pipe = redis.pipeline()
                    pipe.setex(key,                          _CACHE_TTL_SECONDS, json.dumps(prices))
                    pipe.setex(_stale_key(ticker, period),   _STALE_TTL_SECONDS, json.dumps(prices))
                    await pipe.execute()
                    logger.debug("Cache SET %s/%s TTL=%ds", ticker, period, _CACHE_TTL_SECONDS)
                except Exception as exc:
                    logger.warning("Redis SETEX failed (non-fatal): %s", exc)
            return prices

        # ── 3. Stale-if-error: serve expired cache rather than nothing ────────
        if redis is not None:
            try:
                stale = await redis.get(_stale_key(ticker, period))
                if stale:
                    prices = json.loads(stale)
                    logger.warning(
                        "yfinance unavailable for %s — serving stale cache (%d pts)",
                        ticker, len(prices),
                    )
                    return prices
            except Exception as exc:
                logger.warning("Redis stale-cache GET failed: %s", exc)

        # ── 4. Synthetic fallback — keeps UI functional during Yahoo outages ──
        if allow_synthetic:
            synthetic = _generate_synthetic_prices(ticker)
            logger.warning(
                "All data sources exhausted for %s/%s — returning %d synthetic pts "
                "(Yahoo Finance may be rate-limiting; real data will resume once cached).",
                ticker, period, len(synthetic),
            )
            # Cache synthetic data briefly (30 s) so repeated calls within
            # the same request window don't each re-generate.
            if redis is not None:
                try:
                    await redis.setex(key, 30, json.dumps(synthetic))
                except Exception:
                    pass
            return synthetic

        logger.warning("No price data available for %s/%s and synthetic disabled", ticker, period)
        return None

    @staticmethod
    async def warm_cache(ticker: str, period: str = "1mo") -> None:
        """
        Populate the stale-if-error key alongside the normal TTL key.
        Called after every successful fetch so the fallback always has data.
        Synthetic data is intentionally excluded from the stale cache so it
        never masquerades as real data across restarts.
        """
        redis = get_redis_client()
        if redis is None:
            return

        # Bypass synthetic so we only cache real yfinance data here.
        prices = await asyncio.to_thread(
            MarketDataService._fetch_historical_price, ticker, period
        )
        if prices:
            try:
                await redis.setex(_stale_key(ticker, period), _STALE_TTL_SECONDS, json.dumps(prices))
                logger.debug("Stale cache warmed for %s/%s (%d pts)", ticker, period, len(prices))
            except Exception as exc:
                logger.warning("Redis stale warm failed: %s", exc)
