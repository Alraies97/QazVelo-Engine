#!/bin/bash
set -euo pipefail

# =============================================================================
# QazVelo-Engine startup
#
# Brings up the full backend stack and runs the API end-to-end:
#   - Postgres, Redis, Kafka (+ Zookeeper) via the repo's docker-compose stack
#   - builds the C++ (pybind11) analytics module for the *active* Python
#   - starts the Kafka worker, then the FastAPI server on :8000
#
# The previous version assumed local redis/postgres/initdb binaries, hardcoded
# the Python 3.11 module suffix, created a `runner` Postgres role (mismatching
# the app's `postgres:password` DSN), and never started Kafka (which the app's
# startup requires). This version fixes all of that.
# =============================================================================

cd "$(dirname "$0")"

echo "=== QazVelo-Engine Startup ==="

# --- Choose a Python runner (prefer the Poetry env so deps are available) -----
if command -v poetry >/dev/null 2>&1 && [ -f pyproject.toml ]; then
    RUN="poetry run"
else
    RUN=""
fi
PY="$RUN python3"

# --- Compose command detection (docker compose v2, fallback to docker-compose)-
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    echo "ERROR: docker compose is required to start the infrastructure (Postgres/Redis/Kafka)." >&2
    exit 1
fi

# Keep the DB DSN aligned with docker-compose (postgres:password) unless the
# caller already provided one (e.g. via .env).
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:password@localhost:5432/qazvelo_db}"

# --- Infrastructure (Postgres, Redis, Kafka, Zookeeper) ----------------------
echo "Starting infrastructure (Postgres, Redis, Kafka, Zookeeper)..."
$COMPOSE up -d postgres redis zookeeper kafka

echo -n "Waiting for Postgres"
until $COMPOSE exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
    echo -n "."; sleep 1
done
echo " OK"

echo -n "Waiting for Redis"
until $COMPOSE exec -T redis redis-cli ping >/dev/null 2>&1; do
    echo -n "."; sleep 1
done
echo " OK"

# Kafka: the app's startup opens a producer, so wait for the broker to actually
# answer API requests (port-open alone is not enough).
echo -n "Waiting for Kafka broker"
until $COMPOSE exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; do
    echo -n "."; sleep 2
done
echo " OK"

# --- C++ analytics module (pybind11) -----------------------------------------
# Derive the extension suffix from the *active* interpreter instead of hardcoding
# a Python version (e.g. .cpython-312-x86_64-linux-gnu.so).
EXT_SUFFIX="$($PY -c 'import sysconfig; print(sysconfig.get_config_var("EXT_SUFFIX"))')"
SOFILE="qazvelo_analytics${EXT_SUFFIX}"

if [ ! -f "$SOFILE" ]; then
    echo "Building C++ analytics module ($SOFILE)..."
    PY_EXE="$($PY -c 'import sys; print(sys.executable)')"
    # pybind11 is a build-time dependency for the C++ module; ensure it is present
    # in the active environment (it is not declared in pyproject).
    if ! $PY -c 'import pybind11' >/dev/null 2>&1; then
        echo "Installing pybind11 (build dependency)..."
        $RUN pip install pybind11
    fi
    # Pass pybind11's cmake dir explicitly so the build does not depend on a
    # system `python3` that may lack pybind11.
    PYBIND11_DIR="$($PY -c 'import pybind11; print(pybind11.get_cmake_dir())')"
    rm -rf build && mkdir -p build
    (
        cd build
        cmake .. -DCMAKE_BUILD_TYPE=Release -DPython3_EXECUTABLE="$PY_EXE" -Dpybind11_DIR="$PYBIND11_DIR"
        make -j"$(nproc)"
    )
    # The compiled module may be named for the build's python; copy whatever was produced.
    cp build/qazvelo_analytics*.so .
fi
$PY -c "import qazvelo_analytics; print('C++ module: OK')"

# --- Kafka worker (consumes market_analytics) --------------------------------
echo "Starting Kafka worker..."
$RUN python3 -m app.api.worker &
WORKER_PID=$!
# Make sure the worker is stopped when this script exits.
trap 'echo; echo "Shutting down worker (pid $WORKER_PID)..."; kill "$WORKER_PID" 2>/dev/null || true' EXIT

# --- FastAPI server ----------------------------------------------------------
echo "Starting QazVelo FastAPI server on port 8000..."
$RUN uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info
