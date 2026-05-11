"""Back-compat shim package: routers now live under `app.api`."""

from app.api import analyses, auth, datasets  # noqa: F401

__all__ = ["analyses", "auth", "datasets"]
