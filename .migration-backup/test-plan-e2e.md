# E2E Test Plan — QazVelo-Engine (PR #4 + merged auth PR #3)

## Environment (already set up)
- Infra via docker-compose: Postgres (5432), Redis (6379), Kafka (9092), Zookeeper.
- Backend: `uvicorn app.main:app` on :8000 (C++ pybind11 core compiled, Kafka producer up).
- Worker: `python -m app.api.worker` consuming `market_analytics`.
- Frontend: `npm run dev` on :3000.

## What changed / what to prove
- Merged PR #3: login/register screen + auth context gate the dashboard; tokens via `api.ts`; wallet auto-created on first login.
- PR #4 (under test): MARKET orders now actually EXECUTE. Before fix, schema enum != model enum, so `WalletService.place_mock_order` skipped execution and orders stayed `PENDING` with balance unchanged.
- UI path traced: `frontend/app/page.tsx` gates on `useAuth()` → `AuthScreen.tsx` (register/login) → dashboard with `MarketOverview.tsx` (POST `/analytics/ticker-calculate`) + `BuySellCard.tsx` (GET `/wallet` → POST `/wallet/orders`).

## Primary E2E flow (single continuous recording)

### Test 1: It should let a new user register and land on the gated dashboard
- Action: load `localhost:3000`; click "Register"; enter unique username (`demo<rand>`), email, password (≥8 chars); submit.
- Pass: the auth screen disappears and the dashboard renders (Sidebar + Navbar with the username + Market Overview + Buy/Sell card).
- Fail: stays on auth screen / error banner / blank.
- Discriminating: if auth context/gate were broken, the dashboard would not render.

### Test 2: It should render the market chart from real backend analytics
- Action: observe the Market Overview panel after login.
- Pass: a line chart renders with a numeric BTC price + a % change value (data sourced from `/analytics/ticker-calculate` → C++ SMA over yfinance BTC-USD, ~32 points). Not the "Authentication required" / "backend down" error state.
- Fail: error/empty state or no chart.
- Discriminating: a broken API wiring or auth header would show the error state instead of a chart.

### Test 3: It should execute a MARKET BUY and update wallet balance + position (core of PR #4)
- Precondition: note starting balance shown (fresh wallet = $10,000).
- Action: in Buy/Sell card, ensure side = BUY, type = MARKET, asset = BTC, quantity = `0.1`, price = `65000` (if a price field is required); click Buy/Submit.
- Pass: success feedback appears AND the order resolves to `EXECUTED`. Backend confirmation (via API/DB log captured alongside): order `status=EXECUTED`, wallet balance `10000 → 3500` (0.1×65000=6500 deducted), position `BTC 0.1 @ 65000` created.
- Fail (i.e. bug still present): order stays `PENDING`, balance remains `10000`, no position.
- Discriminating: THIS is the exact assertion that differs between broken (PENDING, no balance change) and fixed (EXECUTED, balance drops, position created).

## Evidence to capture
- Screenshots: auth screen, dashboard+chart, buy form filled, success + post-trade state.
- Backend log lines for the order request; DB/API readback of wallet showing balance 3500 + position.
