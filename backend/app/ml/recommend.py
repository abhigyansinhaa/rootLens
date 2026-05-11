"""Back-compat shim: canonical implementation lives at `app.decisioning.recommend`."""

from app.decisioning.recommend import *  # noqa: F401,F403
from app.decisioning.recommend import build_recommendations  # noqa: F401

__all__ = ["build_recommendations"]
