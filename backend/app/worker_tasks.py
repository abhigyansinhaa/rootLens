"""Back-compat shim: canonical implementation lives at `app.infrastructure.worker_tasks`."""

from app.infrastructure.worker_tasks import run_analysis_task  # noqa: F401

__all__ = ["run_analysis_task"]
