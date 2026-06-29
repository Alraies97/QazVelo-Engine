"""
backend/app/core/connection_manager.py

Thread-safe broadcast hub for the live market-price WebSocket feed.

Each browser client that connects to GET /api/v1/ws/market?symbol=BTCUSDT
is registered here.  When BinanceStreamAdapter receives a price tick it calls
market_manager.broadcast(symbol, payload) which fans the message out to every
subscriber of that symbol in one asyncio task.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger("QazVelo-Market")


class MarketConnectionManager:
    """Singleton that maps Binance symbols → sets of active browser WebSockets."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, symbol: str) -> None:
        async with self._lock:
            self._connections[symbol].add(websocket)
        logger.info(
            "[MarketWS] +client for %s (total=%d)",
            symbol,
            len(self._connections[symbol]),
        )

    async def disconnect(self, websocket: WebSocket, symbol: str) -> None:
        async with self._lock:
            self._connections[symbol].discard(websocket)
            if not self._connections[symbol]:
                del self._connections[symbol]
        logger.info("[MarketWS] -client from %s", symbol)

    async def broadcast(self, symbol: str, payload: dict) -> None:
        """Fan out payload to every client subscribed to symbol."""
        clients = set(self._connections.get(symbol, set()))
        if not clients:
            return
        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws, symbol)

    @property
    def subscriber_counts(self) -> dict[str, int]:
        return {sym: len(ws_set) for sym, ws_set in self._connections.items()}


market_manager = MarketConnectionManager()
