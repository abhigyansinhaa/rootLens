"""Back-compat shim: canonical implementation lives at `app.pipelines.common`."""

from app.pipelines.common import TaskType, detect_task_type  # noqa: F401

__all__ = ["TaskType", "detect_task_type"]
