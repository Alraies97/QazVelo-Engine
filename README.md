# QazVelo Engine

> **Real-time market analytics and paper-trading platform** — live Binance price streams, SMA/volatility calculations, mock order execution, price alerts, and a full authentication layer.

**🚀 Live Demo: [https://qazvelo-engine.vercel.app](https://qazvelo-engine.vercel.app)**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
   - [System Diagram](#system-diagram)
   - [Component Breakdown](#component-breakdown)
   - [Data Flow](#data-flow)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Prerequisites](#prerequisites)
6. [Installation & Local Development](#installation--local-development)
   - [Option A — Local (no Docker)](#option-a--local-no-docker)
   - [Option B — Docker Compose](#option-b--docker-compose)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
   - [Base URL](#base-url)
   - [Authentication](#authentication)
   - [Auth Endpoints](#auth-endpoints)
   - [User Endpoints](#user-endpoints)
   - [Analytics Endpoints](#analytics-endpoints)
   - [Wallet Endpoints](#wallet-endpoints)
   - [Price Alert Endpoints](#price-alert-endpoints)
   - [Binance Endpoints](#binance-endpoints)
   - [Health Endpoint](#health-endpoint)
   - [WebSocket Endpoints](#websocket-endpoints)
9. [Rate Limiting](#rate-limiting)
10. [Background Services](#background-services)
11. [Frontend](#frontend)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Security Notes](#security-notes)
15. [Contributing](#contributing)

---

## Overview

QazVelo Engine is a full-stack web application for real-time financial market analytics and paper trading. Users can:

- Register/log in with JWT-based authentication (access + refresh tokens).
- View a live dashboard with BTC and ETH price ticks streamed directly from Binance via WebSocket.
- Run technical analysis calculations (Simple Moving Average, volatility) on any ticker using Yahoo Finance historical data.
- Place and track mock buy/sell orders (MARKET and LIMIT types) against a simulated wallet.
- Set price alerts that trigger automatically when live market prices cross a defined threshold.
- Export their analytics history and order history as a CSV file.
- Optionally route live orders to Binance (testnet or mainnet) when `ENABLE_BINANCE_LIVE_TRADING=true`.

---

## Architecture

### System Diagram

```
Browser (React + Vite)
        │
        │  HTTP /api/v1/*
        │  WS  /api/v1/ws/*
        ▼
Express Proxy  (port 8080)
        │   Forwards all /api/v1/* traffic
        ▼
FastAPI Backend  (port 8000)
   ├── PostgreSQL   — persistent storage (users, wallets, orders, alerts, analytics)
   ├── Redis        — rate-limiter token buckets + historical price cache
   ├── Kafka        — optional analytics event bus (graceful fallback to direct DB write)
   └── Binance WSS  — live aggTrade streams (BTCUSDT, ETHUSDT)
           │
           ▼ fanned-out via ConnectionManager
       Browser WebSocket clients
```

### Component Breakdown

| Layer | Technology | Responsibility |
|---|---|---|
| **Frontend** | React 18, Vite, Wouter, Recharts, Tailwind CSS v4 | SPA dashboard — charts, wallet, analytics, settings |
| **Express Proxy** | Express 5, TypeScript | Reverse-proxy that forwards `/api/v1/*` to FastAPI; adds logging via Pino |
| **FastAPI Backend** | FastAPI 0.115, Python 3.11 | REST + WebSocket API, business logic, Binance integration |
| **PostgreSQL** | PostgreSQL 16 | Primary relational store |
| **Redis** | Redis 7 (or `fakeredis` in dev) | Rate limiting (fastapi-limiter) + Yahoo Finance price cache |
| **Kafka** | Apache Kafka (optional) | Decoupled analytics ingestion via `market_analytics` topic |
| **Binance** | WebSocket aggTrade | Public real-time price ticks; optional live order execution |

### Data Flow

**Live price tick (WebSocket):**
```
Binance aggTrade WSS
  → BinanceStreamAdapter (backend/app/api/binance.py)
  → ConnectionManager.broadcast(symbol, price)
  → Browser clients subscribed to /api/v1/ws/market?symbol=BTCUSDT
```

**Analytics calculation (HTTP):**
```
POST /api/v1/analytics/ticker-calculate
  → MarketDataService.get_historical_price()  (Yahoo Finance → Redis cache)
  → MarketAnalyticsService.process_market_indicators()  (SMA, volatility via C++ binding or Python)
  → persist AnalyticsModel to PostgreSQL
  → return TickerCalculateResponse
```

**Mock order execution (LIMIT orders):**
```
Kafka/WebSocket price update
  → worker.process_price_update()
  → match pending LIMIT orders against current market price
  → update MockOrder.status = EXECUTED, adjust MockWallet.balance / MockPosition
```

**Price alert triggering:**
```
Kafka/WebSocket price update
  → worker.process_price_update()
  → compare PriceAlert.target_price vs market_price
  → set is_active=False, triggered_at=now()
  → publish notification to Kafka topic `alerts_notifications`
```

---

## Tech Stack

**Backend**

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.115.6 | Async web framework |
| `uvicorn[standard]` | 0.34.0 | ASGI server |
| `sqlalchemy` | 2.0.41 | Async ORM |
| `asyncpg` | 0.30.0 | Async PostgreSQL driver |
| `pyjwt` | 2.8.0 | JWT signing/verification |
| `passlib[bcrypt]` / `bcrypt` | 1.7.4 / 4.3.0 | Password hashing |
| `fastapi-limiter` | 0.1.6 | Redis-backed rate limiting |
| `redis` | 5.2.1 | Redis client |
| `fakeredis` | 2.26.2 | In-process Redis stub for development |
| `aiokafka` | 0.11.0 | Async Kafka producer/consumer |
| `yfinance` | 0.2.54 | Yahoo Finance historical price data |
| `websockets` | 15.0.1 | Binance WebSocket stream client |
| `pydantic[email]` / `pydantic-settings` | 2.11.7 / 2.7.1 | Validation and settings management |
| `httpx` | 0.28.1 | Async HTTP client |

**Frontend**

| Package | Purpose |
|---|---|
| React 18 + Vite | SPA framework and build tool |
| Wouter | Lightweight client-side routing |
| Tailwind CSS v4 | Utility-first styling |
| Recharts | Market charts |
| Axios | HTTP client with JWT interceptor and auto-refresh |
| shadcn/ui | Component library |
| TypeScript 5.9 | Static typing |

**Tooling**

- `pnpm` workspaces (monorepo)
- `concurrently` — parallel dev process runner
- Orval — OpenAPI → TypeScript + Zod codegen
- Playwright — end-to-end testing
- Docker Compose — full-stack container orchestration

---

## Repository Structure

```
.
├── artifacts/
│   ├── qazvelo/          # React + Vite frontend SPA
│   │   └── src/
│   │       ├── components/   # UI components (AuthScreen, MarketOverview, WalletView, …)
│   │       ├── lib/          # api.ts, auth.tsx, types.ts, ws.ts, format.ts
│   │       └── App.tsx
│   ├── api-server/       # Express 5 reverse-proxy
│   │   └── src/
│   │       ├── routes/       # health.ts, index.ts (proxy handler)
│   │       └── app.ts
│   └── mockup-sandbox/   # Isolated Vite sandbox for UI component prototyping
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers
│   │   │   ├── auth.py          # /auth — register, login, refresh
│   │   │   ├── users.py         # /users — profile, password change
│   │   │   ├── analytics.py     # /analytics — calculate, history, export
│   │   │   ├── wallet.py        # /wallet — create, summary, orders
│   │   │   ├── alerts.py        # /alerts — CRUD price alerts
│   │   │   ├── binance.py       # /binance — stream management + live orders
│   │   │   ├── health.py        # /health — deep health check
│   │   │   ├── ws_analytics.py  # WS /ws/analytics — real-time analytics ingest
│   │   │   ├── ws_market.py     # WS /ws/market — live price broadcast
│   │   │   └── worker.py        # Kafka consumer + price-update processor
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings (env vars)
│   │   │   ├── database.py      # Async SQLAlchemy engine + session
│   │   │   ├── security.py      # JWT helpers, password hashing
│   │   │   ├── cache.py         # Redis/fakeredis singleton
│   │   │   └── connection_manager.py  # WebSocket broadcast hub
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Business logic (analytics, market_data, wallet)
│   │   └── main.py       # FastAPI app factory and lifespan
│   ├── requirements.txt
│   ├── run.py            # Entrypoint with dev SECRET_KEY bootstrap
│   └── Dockerfile
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml  # OpenAPI 3.1 contract (source of truth)
│   └── api-zod/          # Orval-generated TypeScript types + Zod schemas
├── scripts/
│   ├── start-all.sh      # Dev convenience script
│   └── post-merge.sh     # Git hook helper
├── .env.example          # Full environment variable reference
├── docker-compose.yml    # Full-stack Docker Compose definition
├── Dockerfile.frontend   # Vite frontend container
├── Dockerfile.proxy      # Express proxy container
├── package.json          # pnpm workspace root + dev scripts
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20 LTS (24 recommended) | Required for frontend and proxy |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.11+ | Required for backend |
| uv | latest | Fast Python package manager — `pip install uv` |
| PostgreSQL | 16 | Can be provided via Docker Compose |
| Redis | 7 | Optional in development — falls back to fakeredis |
| Docker + Docker Compose | v2+ | Required only for the Docker setup |

---

## Installation & Local Development

### Option A — Local (no Docker)

**1. Clone and install dependencies**

```bash
git clone <repo-url>
cd qazvelo-engine

# Install Node dependencies (frontend + proxy + tooling)
pnpm install

# Install Python dependencies
cd backend
uv sync          # reads pyproject.toml / uv.lock
# or:  pip install -r requirements.txt
cd ..
```

**2. Configure environment**

```bash
cp .env.example .env
# Open .env and set at minimum:
#   DATABASE_URL  — your local PostgreSQL connection string
#   SECRET_KEY    — run.py auto-generates this in development if left blank
```

**3. Start all three processes concurrently**

```bash
pnpm dev
```

This runs (in parallel via `concurrently`):

| Process | Port | Command |
|---|---|---|
| Vite frontend | 5000 | `pnpm --filter @workspace/qazvelo run dev` |
| Express proxy | 8080 | `pnpm --filter @workspace/api-server run dev` |
| FastAPI backend | 8000 | `cd backend && python run.py` |

Open [http://localhost:5000](http://localhost:5000) in your browser.

The FastAPI interactive docs are available at [http://localhost:8000/api/v1/openapi.json](http://localhost:8000/api/v1/openapi.json) and the Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs).

**4. Run only a single service**

```bash
pnpm run dev:frontend   # Vite only
pnpm run dev:proxy      # Express proxy only
pnpm run dev:backend    # FastAPI only
```

---

### Option B — Docker Compose

**1. Configure environment**

```bash
cp .env.example .env
# Set SECRET_KEY at minimum. DATABASE_URL defaults to the bundled postgres service.
```

**2. Start the full stack**

```bash
docker compose up         # foreground with combined logs
docker compose up -d      # detached
docker compose up backend # single service only
```

Services started:

| Service | Port | Image |
|---|---|---|
| `redis` | 6379 | `redis:7-alpine` |
| `postgres` | 5432 | `postgres:16-alpine` |
| `backend` | 8000 | Built from `backend/Dockerfile` |
| `proxy` | 8080 | Built from `Dockerfile.proxy` |
| `frontend` | 5000 | Built from `Dockerfile.frontend` |

Hot-reload is enabled in Docker Compose via `develop.watch` — source file changes sync automatically.

---

## Environment Variables

All variables are documented in `.env.example`. Key variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `SECRET_KEY` | **Yes in production** | *(auto-generated in dev)* | JWT signing key — min 32 characters |
| `DATABASE_URL` | **Yes** | `postgresql+asyncpg://postgres:password@localhost:5432/qazvelo_db` | Async PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Falls back to in-process `fakeredis` if unreachable |
| `KAFKA_BOOTSTRAP_SERVERS` | No | `localhost:9092` | Analytics pipeline falls back to direct DB writes if absent |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `BINANCE_API_KEY` | No | *(empty)* | Required for live order execution only |
| `BINANCE_SECRET_KEY` | No | *(empty)* | Required for live order execution only |
| `BINANCE_TESTNET` | No | `true` | `true` → testnet.binance.vision |
| `ENABLE_BINANCE_LIVE_TRADING` | No | `false` | Master kill-switch for routing orders to Binance |
| `BACKEND_URL` | No | `http://localhost:8000` | FastAPI origin used by the Vite proxy |
| `PORT` | No | `5000` (frontend) / `8000` (backend) / `8080` (proxy) | Bind port per service |

Generate a secure secret key:

```bash
python -c "import secrets; print(secrets.token_hex(48))"
```

---

## API Reference

### Base URL

```
http://localhost:8000/api/v1
```

All routes below are relative to this base. The Swagger interactive docs are served at `/docs` and the ReDoc alternative at `/redoc`.

---

### Authentication

Protected endpoints require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are issued by `POST /auth/login`. The access token expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 min). Use `POST /auth/refresh` with the refresh token to rotate both tokens without re-authenticating.

---

### Auth Endpoints

#### `POST /auth/register`

Register a new user account.

**Request body**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "s3cr3tPass!"
}
```

**Response `201`**

```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "is_active": true
}
```

**Errors:** `400 Bad Request` — username or email already registered.

---

#### `POST /auth/login`

Authenticate and receive JWT tokens.

*Rate limit: 5 requests / 60 s per IP.*

**Request body**

```json
{
  "username": "alice",
  "password": "s3cr3tPass!"
}
```

**Response `200`**

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors:** `401 Unauthorized` — wrong credentials. `403 Forbidden` — account inactive.

---

#### `POST /auth/refresh`

Exchange a valid refresh token for a new token pair.

*Rate limit: 5 requests / 60 s per IP.*

**Request body**

```json
{
  "refresh_token": "<refresh_jwt>"
}
```

**Response `200`** — same shape as `/auth/login`.

**Errors:** `401 Unauthorized` — token expired or invalid.

---

### User Endpoints

#### `GET /users/me`

Return the currently authenticated user's profile.

*Requires auth.*

**Response `200`**

```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "is_active": true
}
```

---

#### `PUT /users/update`

Update username and/or email.

*Requires auth. Rate limit: 10 requests / 60 s.*

**Request body** (all fields optional)

```json
{
  "username": "alice2",
  "email": "alice2@example.com"
}
```

**Response `200`** — updated `UserResponse`.

**Errors:** `400 Bad Request` — username or email already taken.

---

#### `POST /users/change-password`

Change the current user's password.

*Requires auth. Rate limit: 3 requests / 60 s.*

**Request body**

```json
{
  "old_password": "s3cr3tPass!",
  "new_password": "newPass123!"
}
```

**Response `200`**

```json
{ "message": "Password updated successfully" }
```

**Errors:** `400 Bad Request` — incorrect old password or new password exceeds bcrypt 72-byte limit.

---

### Analytics Endpoints

#### `POST /analytics/ticker-calculate`

Fetch historical OHLC data from Yahoo Finance, compute SMA and volatility over a sliding window, and persist the result.

*Requires auth. Rate limit: 10 requests / 60 s.*

**Request body**

```json
{
  "ticker": "BTC-USD",
  "period": "1mo",
  "calculation_window": 3
}
```

| Field | Type | Values | Description |
|---|---|---|---|
| `ticker` | string | e.g. `BTC-USD`, `AAPL` | Yahoo Finance symbol |
| `period` | string | `1mo`, `3mo`, `6mo`, `1y` | Historical data period |
| `calculation_window` | integer ≥ 1 | e.g. `3`, `7`, `14` | Sliding window for SMA/volatility |

**Response `200`**

```json
{
  "status": "success",
  "metrics": {
    "simple_moving_average": [101.2, 102.5, 103.1],
    "volatility": [0.02, 0.018, 0.021]
  },
  "source": "historical_market_data",
  "computed_at": "2026-06-30T07:00:00Z",
  "record_id": 42,
  "persisted_by": "alice"
}
```

**Errors:** `404` — ticker not found. `400` — calculation error.

---

#### `GET /analytics/live-calculate`

Calculate analytics on the most recent live market data stored in the database.

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `metric_name` | string | Metric identifier to query |
| `period` | integer | Rolling period (default `5`) |

**Response `200`** — `TickerCalculateResponse` (same shape as above, `source: "live_market_analytics"`).

---

#### `GET /analytics/history`

Paginated list of persisted analytics records for the authenticated user.

*Requires auth. Rate limit: 30 requests / 60 s.*

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | Page number |
| `page_size` | integer 1–100 | `20` | Records per page |

**Response `200`**

```json
{
  "total": 150,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "id": 42,
      "metric_name": "BTC-USD:SMA_3",
      "metric_value": 67234.5,
      "timestamp": "2026-06-30T07:00:00Z",
      "extra_payload": { "ticker": "BTC-USD", ... }
    }
  ]
}
```

---

#### `GET /analytics/orders-history`

List mock orders for the authenticated user, with optional filters.

*Requires auth. Rate limit: 30 requests / 60 s.*

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `status_filter` | `PENDING` \| `EXECUTED` \| `CANCELED` | Filter by order status |
| `order_type_filter` | `MARKET` \| `LIMIT` | Filter by order type |
| `asset_filter` | string | Partial match on asset symbol |

**Response `200`** — array of `MockOrderResponse` objects.

---

#### `GET /analytics/export`

Download all orders and analytics history as a CSV file.

*Requires auth. Rate limit: 5 requests / 60 s.*

**Response `200`** — `text/csv` stream with `Content-Disposition: attachment; filename=qazvelo-analytics-export-<timestamp>.csv`.

---

### Wallet Endpoints

#### `POST /wallet`

Create a new mock wallet for the authenticated user.

*Requires auth.*

**Query parameter:** `initial_balance` (float, default `10000.0`)

**Response `201`**

```json
{
  "id": 1,
  "user_id": 1,
  "balance": 10000.0
}
```

---

#### `GET /wallet`

Retrieve wallet summary including current balance, open positions, and recent orders.

*Requires auth.*

**Response `200`**

```json
{
  "wallet": { "id": 1, "user_id": 1, "balance": 9500.0 },
  "positions": [
    { "id": 1, "asset_symbol": "BTC", "quantity": 0.005, "average_entry_price": 67000.0 }
  ],
  "recent_orders": [
    { "id": 10, "asset_symbol": "BTC", "order_type": "MARKET", "side": "BUY",
      "price": 67000.0, "quantity": 0.005, "status": "EXECUTED", "created_at": "..." }
  ]
}
```

---

#### `POST /wallet/orders`

Place a mock buy or sell order.

*Requires auth.*

**Request body**

```json
{
  "asset_symbol": "BTC",
  "order_type": "LIMIT",
  "side": "BUY",
  "price": 65000.0,
  "quantity": 0.01
}
```

| Field | Values |
|---|---|
| `order_type` | `MARKET`, `LIMIT` |
| `side` | `BUY`, `SELL` |

**Response `201`** — `MockOrderResponse` with `status: "PENDING"` (LIMIT) or `"EXECUTED"` (MARKET).

---

### Price Alert Endpoints

#### `POST /alerts`

Create a price alert. Triggers when the asset's live market price crosses the target.

*Requires auth.*

**Request body**

```json
{
  "asset_symbol": "BTC",
  "target_price": 70000.0,
  "condition": "above"
}
```

`condition`: `"above"` (trigger when price ≥ target) or `"below"` (trigger when price ≤ target).

**Response `201`** — `PriceAlertResponse`.

---

#### `GET /alerts`

List all price alerts for the authenticated user.

*Requires auth.*

**Query parameter:** `is_active` (boolean, optional) — filter by active/triggered status.

**Response `200`** — array of `PriceAlertResponse`.

```json
[
  {
    "id": 1,
    "user_id": 1,
    "asset_symbol": "BTC",
    "target_price": 70000.0,
    "condition": "above",
    "is_active": true,
    "triggered_at": null,
    "created_at": "2026-06-29T12:00:00Z"
  }
]
```

---

#### `DELETE /alerts/{alert_id}`

Delete a price alert.

*Requires auth.*

**Response `204 No Content`**

**Errors:** `404 Not Found` — alert does not exist or belongs to a different user.

---

### Binance Endpoints

#### `POST /binance/order`

Route an order directly to Binance (testnet or mainnet).

*Requires auth. Only active when `ENABLE_BINANCE_LIVE_TRADING=true`.*

**Request body**

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.001,
  "price": 65000.0,
  "timeInForce": "GTC"
}
```

**Response `200`** — Binance order response JSON.

**Errors:** `403 Forbidden` — live trading is disabled. `400` — Binance rejected the order.

---

### Health Endpoint

#### `GET /health`

Deep health check — no authentication required.

Concurrently probes Redis, PostgreSQL, and Binance stream status.

**Response `200` (healthy or degraded) / `503` (unhealthy)**

```json
{
  "status": "healthy",
  "environment": "development",
  "version": "0.1.0",
  "timestamp": "2026-06-30T07:00:00.000Z",
  "checks": {
    "redis":    { "status": "ok", "latency_ms": 0.42, "detail": "connected" },
    "database": { "status": "ok", "latency_ms": 1.83, "detail": "reachable" },
    "binance_streams": {
      "status": "ok",
      "active": ["BTCUSDT", "ETHUSDT"],
      "expected": 2,
      "detail": "2/2 streams running"
    }
  }
}
```

| Overall status | Meaning |
|---|---|
| `healthy` | All checks OK |
| `degraded` | Redis + DB OK, but Binance stream(s) down — app still serves requests |
| `unhealthy` | Redis or DB unreachable — HTTP 503 |

---

### WebSocket Endpoints

#### `WS /api/v1/ws/market`

Subscribe to live Binance price ticks for a symbol.

```
wss://<host>/api/v1/ws/market?symbol=BTCUSDT&token=<access_jwt>
```

**Incoming server frames**

```json
// On connect
{ "type": "connected", "symbol": "BTCUSDT", "message": "Subscribed to live BTCUSDT price stream (Binance aggTrade)" }

// Price tick (on every Binance aggTrade event)
{ "type": "tick", "symbol": "BTCUSDT", "price": 67234.12, "ts": "2026-06-30T07:00:00.123Z" }

// Heartbeat (every 25 s to prevent proxy timeout)
{ "type": "ping" }

// Auth failure
{ "type": "error", "message": "Authentication failed" }
```

AAPL is not available on Binance — use `GET /analytics/ticker-calculate` for non-crypto assets.

---

#### `WS /api/v1/ws/analytics`

Push analytics metric events from the client for real-time ingest and persistence.

```
wss://<host>/api/v1/ws/analytics?token=<access_jwt>
```

**Client sends**

```json
{
  "metric_name": "BTC-USD:SMA_7",
  "metric_value": 67100.5,
  "user_id": 1,
  "extra_payload": { "window": 7, "ticker": "BTC-USD" }
}
```

**Server responds**

```json
// Kafka available
{ "status": "success", "message": "Data queued for processing", "metric": "BTC-USD:SMA_7" }

// No Kafka (fallback to direct DB)
{ "status": "success", "message": "Data persisted directly (no broker)", "metric": "BTC-USD:SMA_7", "record_id": 43 }

// Error
{ "status": "error", "message": "Invalid JSON" }
```

---

## Rate Limiting

Rate limits are enforced per IP via `fastapi-limiter` (Redis-backed). Limits reset on a per-window basis.

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 req / 60 s |
| `POST /auth/refresh` | 5 req / 60 s |
| `POST /analytics/ticker-calculate` | 10 req / 60 s |
| `GET /analytics/history` | 30 req / 60 s |
| `GET /analytics/orders-history` | 30 req / 60 s |
| `GET /analytics/export` | 5 req / 60 s |
| `PUT /users/update` | 10 req / 60 s |
| `POST /users/change-password` | 3 req / 60 s |

In development with `fakeredis`, rate limits are still enforced in-process. In production, a real Redis instance is required.

---

## Background Services

### Startup Cache Warm

On every backend start, `_warm_startup_cache()` is scheduled as an async background task. It pre-fetches 1-month historical price data for `BTC-USD`, `ETH-USD`, and `AAPL` from Yahoo Finance and writes the results to Redis. This ensures the first user request for these tickers is served from cache with no cold-start latency.

### Binance Stream Adapter

Two `asyncio.Task` tasks run for the lifetime of the application (`btcusdt` and `ethusdt`). Each task maintains a persistent WebSocket connection to `wss://stream.binance.com:9443/ws/<symbol>@aggTrade`, parses price from the `"p"` field of each aggTrade event, and calls `ConnectionManager.broadcast()` to fan the price out to all subscribed browser clients. Tasks reconnect automatically on disconnection with exponential backoff.

### Kafka Consumer / Worker

`backend/app/api/worker.py` contains an `AIOKafkaConsumer` that listens to:

- `market_analytics` — validates and persists `AnalyticsModel` records.
- `price_updates` — processes incoming market price events: executes matching pending LIMIT orders, updates wallet balances and positions, and triggers price alerts.

The worker is launched independently from the FastAPI server. When Kafka is unavailable, the WebSocket analytics endpoint falls back to writing directly to the database.

---

## Frontend

The React SPA lives in `artifacts/qazvelo/src/`.

**Key pages / views:**

| Route | Component | Description |
|---|---|---|
| `/` | `AuthScreen` | Login and registration forms |
| `/dashboard` | `MarketOverview` + `BuySellCard` | Live BTC chart + order placement |
| `/dashboard/analytics` | `AnalyticsView` | SMA chart, order history, CSV export, WebSocket stream |
| `/dashboard/wallet` | `WalletView` | Balance, open positions, recent orders |
| `/dashboard/settings` | `SettingsView` | Profile update, password change, price alerts |

**Auth flow:**

1. `POST /auth/login` → store `access_token` and `refresh_token` in `localStorage`.
2. Axios interceptor attaches `Authorization: Bearer <access_token>` to every request.
3. On `401` response, interceptor calls `POST /auth/refresh` automatically and retries the original request.
4. `AuthContext` (`lib/auth.tsx`) exposes `login`, `register`, `logout`, `updateUser` to the component tree.

**Regenerate TypeScript types from the OpenAPI spec:**

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Testing

**Type checking**

```bash
pnpm run typecheck
```

**End-to-end tests (Playwright)**

```bash
cd artifacts/qazvelo   # or .migration-backup/frontend
pnpm exec playwright test
```

Test specs live in `artifacts/qazvelo/` (or `.migration-backup/frontend/tests/e2e/`). See `TEST_PLAYWRIGHT.md` for setup instructions including browser installation and environment configuration.

---

## Deployment

### Live Deployment

The project is deployed using the following managed services:

| Layer | Service | Notes |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | React + Vite SPA — [qazvelo-engine-frontend.vercel.app](https://qazvelo-engine-frontend.vercel.app) |
| **Backend** | [Railway](https://railway.app) | FastAPI + uvicorn, auto-deployed from `main` branch |
| **Database** | [Neon](https://neon.tech) | Serverless PostgreSQL |
| **Redis** | [Upstash](https://upstash.com) | Serverless Redis for rate limiting and price cache |

**Vercel settings (frontend):**

- Root Directory: `artifacts/qazvelo`
- Build Command: `pnpm --filter @workspace/qazvelo run build`
- Install Command: `cd ../.. && pnpm install`
- Output Directory: `dist/public`
- Environment variable: `VITE_API_BASE_URL=<railway-backend-url>/api/v1`

**Railway settings (backend):**

- Environment variable: `ALLOWED_ORIGINS=["https://qazvelo-engine-frontend.vercel.app"]`
- Environment variable: `DATABASE_URL=<neon-connection-string>`
- Environment variable: `REDIS_URL=<upstash-redis-url>`

### Production Checklist

- [ ] Set `ENVIRONMENT=production` in `.env`.
- [ ] Set `SECRET_KEY` to a cryptographically random value ≥ 32 characters.
- [ ] Point `DATABASE_URL` at a managed PostgreSQL instance (Neon, Supabase, RDS, etc.).
- [ ] Point `REDIS_URL` at a managed Redis instance (Upstash, ElastiCache, etc.).
- [ ] Set `ALLOWED_ORIGINS` to your frontend domain(s) — do not use `*` in production.
- [ ] Set `ALLOWED_HOSTS` to your backend domain(s).
- [ ] If using Binance live trading: set `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BINANCE_TESTNET=false`, and `ENABLE_BINANCE_LIVE_TRADING=true` only after thorough testing on testnet.
- [ ] Configure a process supervisor (systemd, ECS, Kubernetes) to run `python run.py` and the Kafka worker separately.
- [ ] Place a TLS-terminating reverse proxy (nginx, Caddy, Cloudflare) in front of the Express proxy on port 8080.

### Docker Production Build

The Vite frontend Dockerfile currently runs the dev server. For production, replace the `CMD` with a multi-stage build that produces a static bundle and serves it via nginx or a static CDN.

---

## Security Notes

- **Passwords** are hashed with bcrypt (cost factor 12). Bcrypt's 72-byte input limit is enforced at the API level.
- **Timing-safe login**: a dummy hash is verified even when a username is not found to prevent username enumeration via timing.
- **JWT tokens**: access tokens expire in 60 minutes; refresh tokens in 7 days. Both are `HS256` signed with `SECRET_KEY`.
- **Rate limiting**: sensitive endpoints (login, token refresh, password change) are aggressively rate-limited to mitigate brute-force attacks.
- **`SECRET_KEY`**: never hardcoded. `run.py` auto-generates a development key and persists it to `.dev_secret_key` (git-ignored). In production the key must be provided via environment variable; the app refuses to start without it.
- **Binance live trading**: gated behind an explicit opt-in environment variable (`ENABLE_BINANCE_LIVE_TRADING=true`). Defaults to paper-trading mode with no risk to real funds.
- **CORS**: default `*` is intentional for development/Replit previews. Always restrict `ALLOWED_ORIGINS` in production.

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Run `pnpm install` and `uv sync` to set up dependencies.
3. Make your changes, ensuring `pnpm run typecheck` passes with no errors.
4. Run the Playwright test suite and confirm it passes.
5. Open a pull request with a clear description of the change and any relevant context.

The `scripts/post-merge.sh` hook runs `pnpm install` automatically after `git merge` or `git pull` to keep the lockfile in sync.
