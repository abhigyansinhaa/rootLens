import hashlib
import logging
import pickle
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.config import settings
from app.thresholds import SHAP_CACHE_MAX_BYTES, SHAP_CACHE_MAX_FILES

logger = logging.getLogger(__name__)


def _get_cache_dir() -> Path:
    cache_dir = settings.data_dir / "shap_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def _compute_cache_key(
    dataset_hash: str | None,
    schema_hash: str | None,
    model: Any,
    context: str,
) -> str:
    """Compute cache key combining data hashes and exact model state."""
    model_hash = joblib.hash(model)
    parts = [
        str(dataset_hash or "no_ds_hash"),
        str(schema_hash or "no_schema_hash"),
        model_hash,
        context,
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def prune_shap_cache(
    max_bytes: int = SHAP_CACHE_MAX_BYTES,
    max_files: int = SHAP_CACHE_MAX_FILES,
) -> int:
    """Prune oldest cache files (LRU) until total size and file count are within limits."""
    cache_dir = _get_cache_dir()
    files = [p for p in cache_dir.glob("*.pkl") if p.is_file()]
    if not files:
        return 0

    # Sort files by modification time (oldest first)
    files.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0)

    total_size = sum(p.stat().st_size for p in files if p.exists())
    removed_count = 0

    while files and (len(files) > max_files or total_size > max_bytes):
        oldest = files.pop(0)
        try:
            if oldest.exists():
                size = oldest.stat().st_size
                oldest.unlink()
                total_size -= size
                removed_count += 1
        except Exception as e:
            logger.warning(f"Failed to delete old cache file {oldest}: {e}")

    if removed_count > 0:
        logger.info(f"Pruned {removed_count} old SHAP cache files")
    return removed_count


def get_cached_shap_values(
    dataset_hash: str | None,
    schema_hash: str | None,
    model: Any,
    context: str,
) -> tuple[np.ndarray | None, float | None]:
    """Retrieve cached SHAP matrix and base value, if they exist."""
    key = _compute_cache_key(dataset_hash, schema_hash, model, context)
    cache_path = _get_cache_dir() / f"{key}.pkl"

    if not cache_path.exists():
        return None, None

    try:
        with open(cache_path, "rb") as f:
            data = pickle.load(f)
        # Touch file to update mtime for LRU tracking
        cache_path.touch(exist_ok=True)
        logger.info(f"SHAP cache hit for {context} ({key[:8]})")
        return data.get("shap_values"), data.get("base_value")
    except Exception as e:
        logger.warning(f"Failed to load SHAP cache from {cache_path}: {e}")
        return None, None


def save_cached_shap_values(
    dataset_hash: str | None,
    schema_hash: str | None,
    model: Any,
    context: str,
    shap_values: np.ndarray,
    base_value: float,
) -> None:
    """Save SHAP matrix and base value to cache and prune if size limits exceeded."""
    key = _compute_cache_key(dataset_hash, schema_hash, model, context)
    cache_path = _get_cache_dir() / f"{key}.pkl"

    try:
        data = {
            "shap_values": shap_values,
            "base_value": base_value,
        }
        with open(cache_path, "wb") as f:
            pickle.dump(data, f)
        logger.info(f"Saved SHAP cache for {context} ({key[:8]})")
        prune_shap_cache()
    except Exception as e:
        logger.warning(f"Failed to save SHAP cache to {cache_path}: {e}")

