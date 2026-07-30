"""Storage backend factory.

Returns the configured StorageBackend instance based on settings.storage_backend.

To add S3/R2 support in a future sprint:
  1. Create `_s3.py` with an `S3Storage` class implementing StorageBackend.
  2. Add the "s3" case to `get_storage()` below.
  3. Set STORAGE_BACKEND=s3 in Railway Variables.
  Zero changes to any route handler or job are needed.
"""

from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.infrastructure.storage._local import LocalStorage
from app.infrastructure.storage._protocol import StorageBackend


@lru_cache(maxsize=1)
def get_storage() -> StorageBackend:
    """Return the active storage backend (singleton, cached after first call)."""
    backend = settings.storage_backend

    if backend == "local":
        return LocalStorage()

    # ── S3 / R2 slot (future sprint) ──────────────────────────────────────────
    # if backend == "s3":
    #     from app.infrastructure.storage._s3 import S3Storage
    #     return S3Storage()

    raise ValueError(
        f"Unknown storage backend '{backend}'. "
        "Set STORAGE_BACKEND to 'local' (or 's3' once the S3 sprint is complete)."
    )
