"""
backend/app/api/binance.py

Binance Exchange Integration Layer
====================================

PUBLIC MARKET DATA STREAMING  (no API key required)
----------------------------------------------------
Binance's aggTrade WebSocket stream is open to the public:
  wss://stream.binance.com:9443/ws/<symbol>@aggTrade

BinanceStreamAdapter connects here, extracts the trade price from each
message's "p" field, and fans it out to every browser client subscribed via
GET /api/v1/ws/market?symbol=<SYMBOL> (handled in ws_market.py).

Call start_all_streams() from main.py lifespan to activate BTC + ETH feeds.
AAPL is not listed on Binance spot — the frontend falls back to HTTP polling.

LIVE ORDER EXECUTION  (BINANCE_API_KEY + BINANCE_SECRET_KEY required)
----------------------------------------------------------------------
Order routing to Binance is gated behind ENABLE_BINANCE_LIVE_TRADING=true.
See BinanceOrderAdapter for the HMAC-SHA256 signing flow and python-binance
implementation notes.

ENVIRONMENT VARIABLES  (set in Replit Secrets — never in code)
--------------------------------------------------------------
  BINANCE_API_KEY              your Binance API key (optional for market data)
  BINANCE_SECRET_KEY           your Binance secret key (required for orders)
  BINANCE_TESTNET              true (default/safe) | false (mainnet)
  ENABLE_BINANCE_LIVE_TRADING  false (default kill-switch) | true to route orders
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import websockets
import websockets.exceptions
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.users import get_current_user
from app.core.config import settings
from app.core.connection_manager import market_manager
from app.models.users import UserModel

logger = logging.getLogger("QazVelo-Binance")

router = APIRouter(prefix="/binance", tags=["Binance Integration"])

# ─────────────────────────────────────────────────────────────────────────────
# Module-level stream task registry
# ─────────────────────────────────────────────────────────────────────────────

_stream_tasks: list[asyncio.Task] = []


async def start_all_streams() -> None:
    """
    Start Binance aggTrade stream tasks for all supported crypto symbols.
    Called from main.py lifespan on application startup.

    AAPL is intentionally excluded — it's not listed on Binance spot markets.
    The frontend falls back to HTTP polling for non-crypto assets.
    """
    symbols = ["btcusdt", "ethusdt"]
    for sym in symbols:
        adapter = BinanceStreamAdapter(symbol=sym)
        task = asyncio.create_task(adapter.connect(), name=f"binance-stream-{sym}")
        _stream_tasks.append(task)
        logger.info("[Binance] Started live stream task for %s", sym.upper())


async def stop_all_streams() -> None:
    """Cancel all running Binance stream tasks. Called on application shutdown."""
    for task in _stream_tasks:
        if not task.done():
            task.cancel()
    if _stream_tasks:
        await asyncio.gather(*_stream_tasks, return_exceptions=True)
    _stream_tasks.clear()
    logger.info("[Binance] All stream tasks stopped")


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────────────────────────────────────


class BinanceOrderRequest(BaseModel):
    """
    Maps to a Binance NEW_ORDER (POST /api/v3/order) request body.
    Ref: https://binance-docs.github.io/apidocs/spot/en/#new-order-trade
    """
    symbol: str
    side: str
    order_type: str
    quantity: float
    price: Optional[float] = None
    time_in_force: str = "GTC"


class BinanceFill(BaseModel):
    price: str
    qty: str
    commission: str
    commission_asset: str


class BinanceOrderResponse(BaseModel):
    symbol: str
    order_id: int
    client_order_id: str
    transact_time: int
    price: str
    orig_qty: str
    executed_qty: str
    status: str
    type: str
    side: str
    fills: list[BinanceFill]


class BinanceTickerPrice(BaseModel):
    symbol: str
    price: str
    fetched_at: datetime


class BinanceStreamStatus(BaseModel):
    connected: bool
    stream_url: Optional[str]
    symbol: Optional[str]
    live_trading_enabled: bool
    testnet: bool
    api_key_configured: bool
    active_streams: list[str]
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Adapter: Live Market Stream  (PUBLIC — no API key needed)
# ─────────────────────────────────────────────────────────────────────────────


class BinanceStreamAdapter:
    """
    Connects to Binance's public aggTrade WebSocket stream and fans each price
    tick out to every browser client subscribed via ws_market.py.

    Uses mainnet for market data regardless of BINANCE_TESTNET — the testnet
    stream only carries simulated prices from a Binance test account and is
    not suitable for real-time chart display.

    Reconnects automatically with exponential back-off (1s → 60s cap) on any
    connection error or clean close from the server side.
    """

    MAINNET_BASE = "wss://stream.binance.com:9443"

    def __init__(self, symbol: str) -> None:
        self.symbol = symbol.lower()          # e.g. "btcusdt"
        self._running = False
        self._ws = None

    @property
    def stream_url(self) -> str:
        return f"{self.MAINNET_BASE}/ws/{self.symbol}@aggTrade"

    async def connect(self) -> None:
        """
        Open a persistent WebSocket connection to the Binance aggTrade stream
        and forward every price tick to the MarketConnectionManager broadcast.

        Reconnects with exponential back-off on any error.
        Respects asyncio.CancelledError so task cancellation is clean.
        """
        self._running = True
        backoff = 1.0

        while self._running:
            try:
                async with websockets.connect(
                    self.stream_url,
                    ping_interval=20,
                    ping_timeout=10,
                    open_timeout=15,
                ) as ws:
                    self._ws = ws
                    logger.info("[Binance] Connected: %s", self.stream_url)
                    backoff = 1.0  # reset on successful connect

                    async for raw_msg in ws:
                        if not self._running:
                            break
                        try:
                            data = json.loads(raw_msg)
                            # aggTrade message shape: {"e":"aggTrade","p":"67234.00",...}
                            price = float(data.get("p", 0))
                            if price > 0:
                                await self._on_tick(price)
                        except (json.JSONDecodeError, ValueError, KeyError):
                            continue

            except asyncio.CancelledError:
                logger.info("[Binance] Stream task cancelled: %s", self.symbol)
                self._running = False
                break
            except (
                websockets.exceptions.ConnectionClosed,
                websockets.exceptions.WebSocketException,
                OSError,
            ) as exc:
                if not self._running:
                    break
                logger.warning(
                    "[Binance] %s disconnected (%s), reconnecting in %.0fs…",
                    self.symbol.upper(), exc, backoff,
                )
                try:
                    await asyncio.sleep(backoff)
                except asyncio.CancelledError:
                    self._running = False
                    break
                backoff = min(backoff * 2, 60.0)
            except Exception as exc:
                if not self._running:
                    break
                logger.error("[Binance] Unexpected error for %s: %s", self.symbol, exc)
                try:
                    await asyncio.sleep(backoff)
                except asyncio.CancelledError:
                    self._running = False
                    break
                backoff = min(backoff * 2, 60.0)

        logger.info("[Binance] Stream stopped: %s", self.symbol)

    async def disconnect(self) -> None:
        """Signal the stream loop to stop and close the connection."""
        self._running = False
        if self._ws is not None:
            await self._ws.close()
            self._ws = None

    async def _on_tick(self, price: float) -> None:
        """
        Broadcast a price tick to all browser clients subscribed to this symbol.

        The payload shape matches what MarketOverview.tsx expects:
            { "type": "tick", "symbol": "BTCUSDT", "price": 67234.12, "ts": "..." }
        """
        sym_upper = self.symbol.upper()
        payload = {
            "type": "tick",
            "symbol": sym_upper,
            "price": price,
            "ts": datetime.now(tz=timezone.utc).isoformat(),
        }
        await market_manager.broadcast(sym_upper, payload)


# ─────────────────────────────────────────────────────────────────────────────
# Adapter: Order Routing  (BINANCE_API_KEY required)
# ─────────────────────────────────────────────────────────────────────────────


class BinanceOrderAdapter:
    """
    Routes a validated QazVelo MockOrder to Binance's signed REST API.

    PRODUCTION STEPS:
    1. pip install python-binance
    2. from binance.client import AsyncClient
       client = await AsyncClient.create(api_key, secret, testnet=testnet)
    3. result = await client.create_order(**binance_params)
    4. Map QazVelo → Binance fields (see SYMBOL_MAP).
    """

    SYMBOL_MAP: dict[str, str] = {
        "BTC-USD": "BTCUSDT",
        "BTC":     "BTCUSDT",
        "ETH-USD": "ETHUSDT",
        "ETH":     "ETHUSDT",
    }

    def __init__(self) -> None:
        self.api_key = settings.BINANCE_API_KEY
        self.secret_key = settings.BINANCE_SECRET_KEY
        self.testnet = settings.BINANCE_TESTNET
        self.live_enabled = settings.ENABLE_BINANCE_LIVE_TRADING

    def _to_binance_symbol(self, qazvelo_symbol: str) -> str:
        return self.SYMBOL_MAP.get(
            qazvelo_symbol.upper(),
            qazvelo_symbol.upper().replace("-USD", "USDT"),
        )

    async def place_order(self, req: BinanceOrderRequest) -> BinanceOrderResponse:
        if not self.live_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Live Binance trading is disabled. "
                    "Set ENABLE_BINANCE_LIVE_TRADING=true in Replit Secrets."
                ),
            )
        if not self.api_key or not self.secret_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "BINANCE_API_KEY and BINANCE_SECRET_KEY must be set "
                    "in Replit Secrets before live order routing is available."
                ),
            )
        raise NotImplementedError("Live Binance order routing — not yet implemented.")


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/status", response_model=BinanceStreamStatus)
async def binance_integration_status(
    current_user: UserModel = Depends(get_current_user),
) -> BinanceStreamStatus:
    """
    Returns the live Binance integration status, including active stream count
    and subscriber counts per symbol from the MarketConnectionManager.
    """
    key_set = bool(settings.BINANCE_API_KEY)
    running_streams = [t.get_name() for t in _stream_tasks if not t.done()]
    active_syms = [n.replace("binance-stream-", "").upper() for n in running_streams]

    return BinanceStreamStatus(
        connected=bool(active_syms),
        stream_url="wss://stream.binance.com:9443/ws/btcusdt@aggTrade",
        symbol="BTCUSDT",
        live_trading_enabled=settings.ENABLE_BINANCE_LIVE_TRADING,
        testnet=settings.BINANCE_TESTNET,
        api_key_configured=key_set,
        active_streams=active_syms,
        message=(
            f"Market data streaming: {len(active_syms)} active stream(s) — "
            + (
                "API key set; set ENABLE_BINANCE_LIVE_TRADING=true for live orders"
                if key_set
                else "set BINANCE_API_KEY for live order routing"
            )
        ),
    )


@router.post("/order", response_model=BinanceOrderResponse)
async def place_binance_order(
    order_request: BinanceOrderRequest,
    current_user: UserModel = Depends(get_current_user),
) -> BinanceOrderResponse:
    """Forward a validated order to Binance's production exchange."""
    adapter = BinanceOrderAdapter()
    return await adapter.place_order(order_request)


@router.get("/ticker/{symbol}", response_model=BinanceTickerPrice)
async def get_live_ticker_price(
    symbol: str,
    current_user: UserModel = Depends(get_current_user),
) -> BinanceTickerPrice:
    """
    Fetch real-time spot price from Binance REST API.
    TODO: GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            f"Live REST ticker for '{symbol}' is not yet implemented. "
            "Use the /api/v1/ws/market WebSocket for real-time prices."
        ),
    )
