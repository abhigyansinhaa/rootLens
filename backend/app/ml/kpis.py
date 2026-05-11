"""Back-compat shim: canonical implementation lives at `app.decisioning.kpis`."""

from app.decisioning.kpis import *  # noqa: F401,F403
from app.decisioning.kpis import compute_kpis  # noqa: F401

__all__ = ["compute_kpis"]
