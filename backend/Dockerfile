# =============================================================================
# QazVelo-Engine — FastAPI Backend Dockerfile
# =============================================================================
FROM python:3.11-slim

# System deps needed by some Python packages (asyncpg, lupa, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Non-root user for security
RUN useradd -m -u 1001 qazvelo && chown -R qazvelo:qazvelo /app
USER qazvelo

EXPOSE 8000

# run.py reads HOST / PORT / ENVIRONMENT from env vars
CMD ["python", "run.py"]
