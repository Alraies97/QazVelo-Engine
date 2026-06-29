"""
QazVelo FastAPI backend entry point.

Ensures SECRET_KEY is available before the app loads:
  1. If the SECRET_KEY env var is already set, use it.
  2. Otherwise load from / generate backend/.dev_secret_key (gitignored).
     This produces a stable random key across restarts in development.
  3. In production set SECRET_KEY via Replit Secrets — the app will
     refuse to start with a dev-generated key when ENVIRONMENT != development.
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
    uvicorn.run(
        "app.main:app",
        host="localhost",
        port=8000,
        reload=True,
        reload_dirs=["app"],
    )
