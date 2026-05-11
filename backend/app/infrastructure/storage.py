"""Local-disk storage helpers (uploads, parquet sidecars, artifact dirs).

Canonical home for upload / artifact path manipulation. `app.storage` is a shim
re-exporting from here during the file-moves transition.
"""

import hashlib
import logging
import shutil
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


def content_hash_of_bytes(content: bytes) -> str:
    """sha256 hex digest of the raw upload bytes (used for dataset fingerprinting)."""
    return hashlib.sha256(content).hexdigest()


def ensure_dirs() -> None:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    settings.data_dir.mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, content: bytes) -> tuple[str, str]:
    """Returns (storage_path, file_format) where file_format is csv or parquet."""
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
            _write_parquet_sidecar(dest)
        except Exception as e:
            logger.info("Parquet sidecar skipped for %s: %s", dest.name, e)

    return resolved, fmt


def parquet_sidecar_path(storage_path: str) -> Path:
    """Return the sidecar `.parquet` path that mirrors a CSV upload."""
    p = Path(storage_path)
    return p.with_suffix(".parquet")


def has_parquet_sidecar(storage_path: str, file_format: str) -> bool:
    if file_format != "csv":
        return False
    return parquet_sidecar_path(storage_path).is_file()


def _write_parquet_sidecar(csv_path: Path) -> None:
    """Best-effort columnar mirror of a freshly-uploaded CSV.

    Failures are non-fatal: callers degrade to reading the CSV directly. Keeping
    this side-effect inside `save_upload` means readers can pick up the sidecar
    without coordinating writes elsewhere.
    """
    import pandas as pd

    df = pd.read_csv(csv_path, low_memory=False)
    sidecar = csv_path.with_suffix(".parquet")
    df.to_parquet(sidecar, index=False)


def delete_file(path: str) -> None:
    p = Path(path)
    if p.is_file():
        p.unlink()
    sidecar = parquet_sidecar_path(path)
    if sidecar.is_file() and sidecar != p:
        try:
            sidecar.unlink()
        except OSError as e:
            logger.info("Failed to remove parquet sidecar %s: %s", sidecar, e)


def analysis_artifact_dir(analysis_id: int) -> Path:
    d = settings.artifacts_dir / str(analysis_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def remove_artifact_dir(analysis_id: int) -> None:
    d = settings.artifacts_dir / str(analysis_id)
    if d.is_dir():
        shutil.rmtree(d, ignore_errors=True)
