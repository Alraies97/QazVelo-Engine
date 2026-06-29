#!/usr/bin/env bash
# QazVelo Engine — composite startup script.
#
# Starts all three services required for the app:
#   - Express API proxy     (port 8080) — proxies /api/v1/* to FastAPI
#   - Vite React frontend   (port 22331) — served to the browser
#   - Python FastAPI backend (port 5000) — business logic + auth + WebSocket
#
# If a port is already in use (e.g. an artifact workflow auto-started the
# service), the script skips starting it to avoid conflicts.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Wait up to TIMEOUT seconds for a port to become occupied, then skip.
# Returns 0 if port was already in use (skip), 1 if still free (start).
port_already_in_use() {
  local port=$1
  local timeout=${2:-8}
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    if nc -z 127.0.0.1 "$port" 2>/dev/null; then
      return 0  # in use — skip
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1  # still free — caller should start the service
}

echo "[start-all] Checking service ports (waiting up to 8s for auto-started services)..."

# Express API server (/api/v1/* proxy → FastAPI)
if port_already_in_use 8080; then
  echo "[start-all] api-server already on port 8080 — skipping"
else
  echo "[start-all] Starting api-server on port 8080"
  PORT=8080 pnpm --filter @workspace/api-server run dev &
fi

# Vite React frontend
if port_already_in_use 22331; then
  echo "[start-all] frontend already on port 22331 — skipping"
else
  echo "[start-all] Starting frontend on port 22331"
  PORT=22331 BASE_PATH=/ pnpm --filter @workspace/qazvelo run dev &
fi

# Python FastAPI backend — always starts here; blocks to keep script alive
echo "[start-all] Starting Python FastAPI backend on port 5000"
cd "$ROOT/backend" && exec python run.py
