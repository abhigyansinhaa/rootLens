"""Back-compat shim: canonical implementation lives at `app.infrastructure.storage` (sub-package)."""

from app.infrastructure.storage import (  # noqa: F401
    StorageBackend,
    analysis_artifact_dir,
    content_hash_of_bytes,
    delete_file,
    ensure_dirs,
    get_storage,
    has_parquet_sidecar,
    parquet_sidecar_path,
    remove_artifact_dir,
    save_upload,
)

__all__ = [
    "StorageBackend",
    "get_storage",
    "analysis_artifact_dir",
    "content_hash_of_bytes",
    "delete_file",
    "ensure_dirs",
    "has_parquet_sidecar",
    "parquet_sidecar_path",
    "remove_artifact_dir",
    "save_upload",
]
