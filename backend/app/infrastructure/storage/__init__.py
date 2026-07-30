"""Storage sub-package public API.

All callers import from `app.infrastructure.storage` — this module re-exports
the active backend's methods as module-level functions so existing call-sites
need zero changes.

  from app.infrastructure.storage import save_upload, delete_file, ensure_dirs ...

Adding a new backend (S3, R2) requires only:
  1. A new `_s3.py` with an `S3Storage` class
  2. Updating `_factory.py` — no changes here or in any caller.
"""

from __future__ import annotations

from pathlib import Path

from app.infrastructure.storage._factory import get_storage
from app.infrastructure.storage._protocol import StorageBackend

__all__ = [
    "StorageBackend",
    "get_storage",
    # Legacy function-style exports (backward compat)
    "ensure_dirs",
    "save_upload",
    "delete_file",
    "content_hash_of_bytes",
    "parquet_sidecar_path",
    "has_parquet_sidecar",
    "analysis_artifact_dir",
    "remove_artifact_dir",
]


# ── Backward-compatible function wrappers ─────────────────────────────────────
# These delegate to the active backend so all existing callers keep working
# without any import changes.

def ensure_dirs() -> None:
    get_storage().ensure_dirs()


def save_upload(filename: str, content: bytes) -> tuple[str, str]:
    return get_storage().save_upload(filename, content)


def delete_file(path: str) -> None:
    get_storage().delete_file(path)


def content_hash_of_bytes(content: bytes) -> str:
    return get_storage().content_hash_of_bytes(content)


def parquet_sidecar_path(storage_path: str) -> Path:
    return get_storage().parquet_sidecar_path(storage_path)


def has_parquet_sidecar(storage_path: str, file_format: str) -> bool:
    return get_storage().has_parquet_sidecar(storage_path, file_format)


def analysis_artifact_dir(analysis_id: int) -> Path:
    return get_storage().analysis_artifact_dir(analysis_id)


def remove_artifact_dir(analysis_id: int) -> None:
    get_storage().remove_artifact_dir(analysis_id)
