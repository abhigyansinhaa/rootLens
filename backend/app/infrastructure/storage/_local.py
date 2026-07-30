"""LocalStorage — disk-based storage backend (default for Docker Compose and Railway Volume).

This is the canonical implementation, moved verbatim from the old
`app/infrastructure/storage.py` flat file. Behaviour is unchanged.
"""

from __future__ import annotations

import hashlib
import logging
import shutil
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class LocalStorage:
    """Stores uploads and artifacts on the local filesystem under settings.data_dir.

    On Railway, mount a Volume at /data so these survive redeploys.
    """

    # ── Directory management ──────────────────────────────────────────────────

    def ensure_dirs(self) -> None:
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
        settings.data_dir.mkdir(parents=True, exist_ok=True)

    # ── Upload handling ───────────────────────────────────────────────────────

    def save_upload(self, filename: str, content: bytes) -> tuple[str, str]:
        """Returns (storage_path, file_format) where file_format is 'csv' or 'parquet'."""
        ext = Path(filename).suffix.lower()
        if ext == ".csv":
            fmt = "csv"
        elif ext in (".parquet", ".pq"):
            fmt = "parquet"
        else:
            raise ValueError("Only .csv and .parquet files are supported")

        uid = uuid.uuid4().hex
        new_name = f"{uid}{ext}"
        dest = settings.uploads_dir / new_name
        dest.write_bytes(content)
        resolved = str(dest.resolve())

        if fmt == "csv":
            try:
                self._write_parquet_sidecar(dest)
            except Exception as e:
                logger.info("Parquet sidecar skipped for %s: %s", dest.name, e)

        return resolved, fmt

    def delete_file(self, path: str) -> None:
        p = Path(path)
        if p.is_file():
            p.unlink()
        sidecar = self.parquet_sidecar_path(path)
        if sidecar.is_file() and sidecar != p:
            try:
                sidecar.unlink()
            except OSError as e:
                logger.info("Failed to remove parquet sidecar %s: %s", sidecar, e)

    def content_hash_of_bytes(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    # ── Artifact handling ─────────────────────────────────────────────────────

    def analysis_artifact_dir(self, analysis_id: int) -> Path:
        d = settings.artifacts_dir / str(analysis_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def remove_artifact_dir(self, analysis_id: int) -> None:
        d = settings.artifacts_dir / str(analysis_id)
        if d.is_dir():
            shutil.rmtree(d, ignore_errors=True)

    # ── Sidecar helpers ───────────────────────────────────────────────────────

    def parquet_sidecar_path(self, storage_path: str) -> Path:
        return Path(storage_path).with_suffix(".parquet")

    def has_parquet_sidecar(self, storage_path: str, file_format: str) -> bool:
        if file_format != "csv":
            return False
        return self.parquet_sidecar_path(storage_path).is_file()

    # ── Private ───────────────────────────────────────────────────────────────

    def _write_parquet_sidecar(self, csv_path: Path) -> None:
        """Best-effort columnar mirror of a freshly-uploaded CSV.

        Failures are non-fatal: callers degrade to reading the CSV directly.
        """
        import pandas as pd

        df = pd.read_csv(csv_path, low_memory=False)
        sidecar = csv_path.with_suffix(".parquet")
        df.to_parquet(sidecar, index=False)
