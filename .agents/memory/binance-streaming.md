---
name: Binance Live Streaming
description: Architecture for Binance aggTrade WS market data in QazVelo — public mainnet, no API key needed, BTC/ETH only.
---

# Binance Live Streaming

## Rule
BTC-USD and ETH-USD use the **public** Binance mainnet aggTrade WebSocket stream — no API key required for market data. AAPL is not listed on Binance spot and always uses synthetic ticking.

**Why:** Binance market data streams are public at `wss://stream.binance.com:9443/ws/<symbol>@aggTrade`. The testnet only carries simulated prices from test accounts and is not suitable for real-time display.

**How to apply:**
- Backend: `BinanceStreamAdapter` in `backend/app/api/binance.py` always connects to mainnet regardless of `BINANCE_TESTNET` setting.
- Frontend: `ASSETS` array in `MarketOverview.tsx` has `binanceSymbol: "BTCUSDT" | "ETHUSDT" | null`. When `null` (AAPL), synthetic ticking is used.
- Ticks are throttled to 1 update/second in the frontend to avoid React re-render thrashing.
- WS ticks are only appended to the chart after the initial SMA fetch completes (`baselineReadyRef`).

## Key files
- `backend/app/core/connection_manager.py` — broadcast hub (symbol → set of WebSocket clients)
- `backend/app/api/ws_market.py` — `/ws/market?symbol=&token=` endpoint
- `backend/app/api/binance.py` — `BinanceStreamAdapter`, `start_all_streams`, `stop_all_streams`
- `artifacts/qazvelo/src/components/MarketOverview.tsx` — WS client + badge
