"""Run Alembic migrations against an arbitrary SQLAlchemy URL (subprocess).

Using a subprocess keeps ``app.config.settings`` out of the migration process and
matches how developers run ``alembic`` from the CLI.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parents[1]


def alembic_upgrade_head(database_url: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_backend_root,
        env=env,
        check=True,
    )
