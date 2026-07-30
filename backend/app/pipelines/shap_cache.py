import hashlib
import logging
import pickle
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.config import settings

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
    """Save SHAP matrix and base value to cache."""
    key = _compute_cache_key(dataset_hash, schema_hash, model, context)
    cache_path = _get_cache_dir() / f"{key}.pkl"
    
    try:
        data = {
            "shap_values": shap_values,
            "base_value": base_value
        }
        with open(cache_path, "wb") as f:
            pickle.dump(data, f)
        logger.info(f"Saved SHAP cache for {context} ({key[:8]})")
    except Exception as e:
        logger.warning(f"Failed to save SHAP cache to {cache_path}: {e}")
