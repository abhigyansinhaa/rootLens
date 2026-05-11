"""Pytest configuration.

The HTTP test suite uses an on-disk SQLite database so the FastAPI lifespan
and ``Base.metadata.create_all`` bind to the same engine across requests.

The database file is removed at session start: SQLite with ``create_all`` does
not apply Alembic-style migrations to an existing file, so a stale database
would miss new columns added to the models.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parents[1]
os.environ.setdefault(
    "SECRET_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)
_sqlite_app = (_backend_root / ".pytest_sqlite_app.db").resolve()
try:
    _sqlite_app.unlink()
except FileNotFoundError:
    pass
except PermissionError:
    pass
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_sqlite_app.as_posix()}")

# Ensure `app` package is importable when running `pytest` from repo root or backend/.
_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))
