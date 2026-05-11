"""Back-compat shim: canonical implementation lives at `app.api.auth`."""

from app.api.auth import *  # noqa: F401,F403
from app.api.auth import router  # noqa: F401

__all__ = ["router"]
