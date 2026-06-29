"""
backend/app/api/ws_market.py

Server-to-client live price broadcast endpoint.

Connect with:  wss://<host>/api/v1/ws/market?symbol=BTCUSDT&token=<jwt>

Message frames sent by the server:
  { "type": "connected", "symbol": "BTCUSDT", "message": "..." }
  { "type": "tick",      "symbol": "BTCUSDT", "price": 67234.12, "ts": "..." }
  { "type": "ping" }    — heartbeat every 25 s to prevent proxy timeout

Price ticks arrive from BinanceStreamAdapter which connects to:
  wss://stream.binance.com:9443/ws/<symbol>@aggTrade
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPAuthorizationCredentials

from app.api.users import get_current_user
from app.core.connection_manager import market_manager
from app.core.database import AsyncSessionLocal

router = APIRouter(prefix="/ws", tags=["Market Price Stream"])


@router.websocket("/market")
async def live_market_price(
    websocket: WebSocket,
    symbol: str = Query(..., description="Binance symbol, e.g. BTCUSDT or ETHUSDT"),
    token: str = Query(..., description="JWT access token"),
) -> None:
    """
    Subscribe to the live Binance price stream for a given symbol.

    The server fans out every Binance aggTrade price tick to all connected
    clients for that symbol.  AAPL is not available on Binance — use the
    HTTP polling endpoint (/analytics/ticker-calculate) for non-crypto assets.
    """
    await websocket.accept()

    try:
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        async with AsyncSessionLocal() as auth_db:
            user = await get_current_user(credentials=creds, db=auth_db)
            _username: str = user.username
    except Exception:
        await websocket.send_json({"type": "error", "message": "Authentication failed"})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    sym = symbol.upper()
    await market_manager.connect(websocket, sym)
    await websocket.send_json({
        "type": "connected",
        "symbol": sym,
        "message": f"Subscribed to live {sym} price stream (Binance aggTrade)",
    })

    try:
        while True:
            await asyncio.sleep(25)
            await websocket.send_json({"type": "ping"})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        await market_manager.disconnect(websocket, sym)
