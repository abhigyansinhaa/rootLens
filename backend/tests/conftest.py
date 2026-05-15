"""Pytest configuration.

The HTTP test suite uses an on-disk SQLite database. Schema is applied with
**Alembic** (``upgrade head``) so tests track the same migration path as MySQL.

The database file is removed at session start before migrations run.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from tests.migration_utils import alembic_upgrade_head

_backend_root = Path(__file__).resolve().parents[1]
os.environ.setdefault(
    "SECRET_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)
_sqlite_app = (_backend_root / ".pytest_sqlite_app.db").resolve()


def pytest_configure(config):  # noqa: ARG001
    try:
        _sqlite_app.unlink()
    except FileNotFoundError:
        pass
    except PermissionError:
        pass
    url = f"sqlite:///{_sqlite_app.as_posix()}"
    os.environ["DATABASE_URL"] = url
    alembic_upgrade_head(url)


# Ensure `app` package is importable when running `pytest` from repo root or backend/.
_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))
