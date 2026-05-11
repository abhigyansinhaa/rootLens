"""Optional Redis Queue for analysis jobs.

Canonical home for the RQ enqueue helper. `app.queue` is a shim re-exporting
from here while the file-moves refactor stabilizes.
"""

from __future__ import annotations

from redis import Redis
from rq import Queue

from app.config import settings
from app.infrastructure.worker_tasks import run_analysis_task


def enqueue_analysis(analysis_id: int, test_size: float, max_rows: int | None) -> None:
    if not settings.redis_url:
        raise RuntimeError("redis_url is not configured")
    conn = Redis.from_url(settings.redis_url)
    q = Queue("default", connection=conn)
    q.enqueue(
        run_analysis_task,
        analysis_id,
        test_size,
        max_rows,
        job_timeout=int(settings.analysis_timeout_s),
    )
