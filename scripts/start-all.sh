#!/usr/bin/env bash
# QazVelo Engine — composite startup script.
#
# All ports are driven by environment variables so the same script works on
# Replit, local Cursor, and inside Docker without modification.
#
# Service layout (defaults match Replit preview requirements):
#   FRONTEND_PORT  (default 5000)  — Vite React app  [must be 5000 on Replit]
#   BACKEND_PORT   (default 8000)  — Python FastAPI
#   PROXY_PORT     (default 8080)  — Express API proxy
#
# The BACKEND_URL variable tells both the Vite dev proxy and the Express proxy
# where FastAPI lives.  Override in Docker: BACKEND_URL=http://backend:8000
#
# Usage:
#   ./scripts/start-all.sh                         # Replit / local defaults
#   FRONTEND_PORT=3000 BACKEND_PORT=9000 ./...     # custom ports

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Port configuration ────────────────────────────────────────────────────────
FRONTEND_PORT="${FRONTEND_PORT:-5000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
PROXY_PORT="${PROXY_PORT:-8080}"
BACKEND_HOST="${BACKEND_HOST:-localhost}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${BACKEND_PORT}}"

# ── Port-in-use check (skip if already occupied by an artifact workflow) ──────
port_already_in_use() {
  local port=$1
  local timeout=${2:-8}
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    if bash -c "echo > /dev/tcp/127.0.0.1/${port}" 2>/dev/null; then
      return 0  # in use — skip
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1  # still free — start the service
}

echo "[start-all] Ports — frontend:${FRONTEND_PORT}  backend:${BACKEND_PORT}  proxy:${PROXY_PORT}"
echo "[start-all] Backend URL: ${BACKEND_URL}"

# ── Vite React frontend ───────────────────────────────────────────────────────
if port_already_in_use "${FRONTEND_PORT}"; then
  echo "[start-all] frontend already on :${FRONTEND_PORT} — skipping"
else
  echo "[start-all] Starting frontend on :${FRONTEND_PORT}"
  PORT="${FRONTEND_PORT}" BASE_PATH=/ BACKEND_URL="${BACKEND_URL}" \
    pnpm --filter @workspace/qazvelo run dev &
fi

# ── Express API proxy ─────────────────────────────────────────────────────────
if port_already_in_use "${PROXY_PORT}"; then
  echo "[start-all] api-server already on :${PROXY_PORT} — skipping"
else
  echo "[start-all] Starting api-server on :${PROXY_PORT}"
  PORT="${PROXY_PORT}" FASTAPI_URL="${BACKEND_URL}" \
    pnpm --filter @workspace/api-server run dev &
fi

# ── Python FastAPI backend (blocks — keeps the script alive) ──────────────────
echo "[start-all] Starting Python FastAPI backend on :${BACKEND_PORT}"
cd "$ROOT/backend" && \
  PORT="${BACKEND_PORT}" HOST="${BACKEND_HOST}" \
  exec python run.py
