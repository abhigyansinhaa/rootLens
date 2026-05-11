"""Back-compat shim: canonical implementation lives at `app.infrastructure.queue`."""

from app.infrastructure.queue import enqueue_analysis  # noqa: F401

__all__ = ["enqueue_analysis"]
