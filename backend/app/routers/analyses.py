"""Back-compat shim: canonical implementation lives at `app.api.analyses`."""

from app.api.analyses import *  # noqa: F401,F403
from app.api.analyses import router  # noqa: F401

__all__ = ["router"]
