"""Storage protocol — defines the interface all storage backends must implement.

Future backends (S3Storage, R2Storage) implement this protocol.
Callers only ever import from `app.infrastructure.storage` — the factory
decides which concrete implementation is returned.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class StorageBackend(Protocol):
    """Interface for all storage implementations."""

    def ensure_dirs(self) -> None:
        """Create required storage directories / buckets if they don't exist."""
        ...

    def save_upload(self, filename: str, content: bytes) -> tuple[str, str]:
        """Persist uploaded bytes.

        Returns:
            (storage_path, file_format) where file_format is 'csv' or 'parquet'.
            storage_path is an opaque string meaningful to this backend only.
        """
        ...

    def delete_file(self, path: str) -> None:
        """Delete an uploaded file (and any sidecars) by its storage_path."""
        ...

    def content_hash_of_bytes(self, content: bytes) -> str:
        """Return a deterministic content fingerprint (sha256 hex) for dedup checks."""
        ...

    def parquet_sidecar_path(self, storage_path: str) -> Path:
        """Return the Path to the parquet sidecar for a given CSV storage_path."""
        ...

    def has_parquet_sidecar(self, storage_path: str, file_format: str) -> bool:
        """Return True if a parquet sidecar exists for the given storage_path."""
        ...

    def analysis_artifact_dir(self, analysis_id: int) -> Path:
        """Return (and create if needed) the artifact directory for an analysis job."""
        ...

    def remove_artifact_dir(self, analysis_id: int) -> None:
        """Recursively delete an analysis artifact directory."""
        ...
