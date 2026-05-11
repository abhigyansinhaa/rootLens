"""Back-compat shim: canonical implementation lives at `app.api.datasets`."""

from app.api.datasets import *  # noqa: F401,F403
from app.api.datasets import router  # noqa: F401

__all__ = ["router"]
