# QazVelo Engine

A real-time market analytics and paper trading platform frontend. Users can sign in/register, view market overview charts, place mock buy/sell orders, review their wallet & positions, explore financial analytics, and manage profile settings & price alerts.

## Run & Operate

- `pnpm --filter @workspace/qazvelo run dev` — run the frontend (Vite dev server)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + next-themes + Tailwind CSS v4 + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- HTTP client: Axios with JWT interceptors + token refresh

## Where things live

- `artifacts/qazvelo/src/` — frontend source (React + Vite)
  - `components/` — all UI components (AuthScreen, Sidebar, Navbar, MarketOverview, BuySellCard, AnalyticsView, WalletView, SettingsView, etc.)
  - `lib/api.ts` — Axios instance with JWT auth + refresh interceptor
  - `lib/auth.tsx` — AuthContext provider (login, register, logout, updateUser)
  - `lib/types.ts` — all shared TypeScript interfaces and enums
  - `lib/format.ts` — currency/number/date formatting helpers
  - `lib/authError.ts` — error extraction and shared input CSS classes
- `artifacts/api-server/` — backend artifact (Express)
- `lib/api-spec/openapi.yaml` — OpenAPI contract source of truth
- `lib/db/src/schema/` — Drizzle ORM schema

## Architecture decisions

- Next.js converted to Vite + React with Wouter for client-side routing.
- Auth is JWT-based (access + refresh token) stored in localStorage; API client auto-refreshes on 401.
- Backend API is expected at `window.location.origin + /api/v1` (configurable via `VITE_API_BASE_URL` or `VITE_API_BASE_PATH`).
- Dark mode default via `next-themes` with `class` strategy.
- All Next.js-specific (`next/link`, `next/image`, `usePathname`, `getServerSideProps`) patterns replaced with Vite/wouter equivalents.

## Product

- Auth screen: login + register with validation
- Dashboard: live SMA market chart (BTC-USD) + buy/sell order card
- Financial Analyst: SMA chart, order history audit table, live analytics fetch, WebSocket stream, analytics history with pagination, CSV export
- Wallet: balance, positions, recent orders (real-time updated via custom events)
- Settings: profile update, password change, price alerts CRUD

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The backend must be running at `/api/v1` for market data, wallet, analytics, and auth to work. The frontend will show error states if the backend is unreachable.
- Routing uses Wouter with `base={import.meta.env.BASE_URL}` — all `<Link href>` values are root-relative paths.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
