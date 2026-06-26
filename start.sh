#!/bin/bash
set -e

echo "=== QazVelo-Engine Startup ==="

# --- Redis ---
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Starting Redis..."
    redis-server --daemonize yes \
        --logfile /tmp/redis.log \
        --port 6379 \
        --bind 127.0.0.1
    sleep 1
fi
redis-cli ping && echo "Redis: OK"

# --- PostgreSQL ---
PGDATA=/tmp/pgdata
PGRUN=/tmp/pgrun

if [ ! -d "$PGDATA" ]; then
    echo "Initializing PostgreSQL..."
    mkdir -p "$PGRUN"
    initdb -D "$PGDATA" --auth=trust -U runner
    cat >> "$PGDATA/postgresql.conf" << 'PGEOF'
listen_addresses = '127.0.0.1'
unix_socket_directories = '/tmp/pgrun'
PGEOF
    echo "host all runner 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
fi

mkdir -p "$PGRUN"

if ! PGPASSWORD='' psql -h 127.0.0.1 -p 5432 -U runner -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo "Starting PostgreSQL..."
    pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" \
        -o "-k $PGRUN" start
    sleep 3
fi

# Create database if needed
if ! PGPASSWORD='' psql -h 127.0.0.1 -p 5432 -U runner -d qazvelo_db -c "SELECT 1" > /dev/null 2>&1; then
    echo "Creating qazvelo_db..."
    PGPASSWORD='' createdb -h 127.0.0.1 -p 5432 -U runner qazvelo_db
fi
echo "PostgreSQL: OK"

# --- C++ Module ---
SOFILE="qazvelo_analytics.cpython-311-x86_64-linux-gnu.so"
if [ ! -f "$SOFILE" ]; then
    echo "Building C++ analytics module..."
    mkdir -p build
    cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/tmp/pyinstall
    make -j$(nproc)
    cd ..
    cp build/$SOFILE .
fi
python3 -c "import qazvelo_analytics; print('C++ module: OK')"

# --- Start FastAPI ---
echo "Starting QazVelo FastAPI server on port 5000..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 5000 \
    --log-level info
