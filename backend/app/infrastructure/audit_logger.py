"""Append-only JSONL audit log for analyses (canonical location).

This is intentionally tiny: a single function, one line per event, one file per
calendar month under ``data/audit/<yyyy-mm>.jsonl``. No DB row per event, no
Kafka, no Elasticsearch — those are explicitly out of scope per the
constrained plan's hard guardrails. Files are rotated by their filename so
operators can ship them off-box with rsync / S3 sync if they need durability
beyond the local disk.

Failures here are best-effort and never raise into the calling job; an audit
write that fails should not turn a completed analysis into a failed one.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def _audit_dir() -> Path:
    d = settings.data_dir / "audit"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _current_log_path(now: datetime | None = None) -> Path:
    ts = now or datetime.now(timezone.utc)
    return _audit_dir() / f"{ts.year:04d}-{ts.month:02d}.jsonl"


def write_event(event: str, payload: dict[str, Any]) -> None:
    """Append one JSONL record describing an analysis lifecycle event."""
    record = {
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "event": str(event),
        "host": os.environ.get("HOSTNAME") or os.environ.get("COMPUTERNAME") or "",
        **payload,
    }
    try:
        path = _current_log_path()
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, default=str) + "\n")
    except Exception as e:
        logger.warning("Audit log write failed for event %s: %s", event, e)
