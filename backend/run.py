"""
QazVelo FastAPI backend entry point.

Environment variables (all optional — safe defaults for local dev):
  PORT        — TCP port uvicorn binds to            (default: 8000)
  HOST        — Bind address                         (default: 0.0.0.0)
  SECRET_KEY  — JWT signing key (≥32 chars)          (auto-generated in dev if absent)
  ENVIRONMENT — "development" | "production"         (default: development)

Secret-key bootstrap (development only):
  1. SECRET_KEY env var already set → use it.
  2. backend/.dev_secret_key file exists + ≥32 chars → load it.
  3. Otherwise generate a random key, persist to .dev_secret_key, and use it.
  In production ENVIRONMENT=production the app refuses to start without SECRET_KEY set.
"""

import os
import secrets
from pathlib import Path

# ── Secret-key bootstrap ──────────────────────────────────────────────────────
if not os.environ.get("SECRET_KEY"):
    _key_file = Path(__file__).parent / ".dev_secret_key"
    if _key_file.exists():
        _stored = _key_file.read_text().strip()
        if len(_stored) >= 32:
            os.environ["SECRET_KEY"] = _stored
        else:
            _stored = secrets.token_hex(48)
            _key_file.write_text(_stored)
            os.environ["SECRET_KEY"] = _stored
    else:
        _key = secrets.token_hex(48)
        _key_file.write_text(_key)
        os.environ["SECRET_KEY"] = _key
# ─────────────────────────────────────────────────────────────────────────────

import uvicorn

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    environment = os.getenv("ENVIRONMENT", "development")
    reload = environment != "production"

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=["app"] if reload else None,
    )
