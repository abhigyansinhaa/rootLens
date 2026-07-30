"""Back-compat shim: canonical implementation lives at `app.pipelines.pipeline`."""

from app.pipelines.pipeline import *  # noqa: F401,F403
from app.pipelines.pipeline import (  # noqa: F401
    TrainResult,
    metrics_to_json,
    train_model,
    train_model_with_fallback,
    training_work_frame,
)
from app.thresholds import ENCODER_VERSION, HIGH_CARD_MAX, MAX_CAT_LEVELS, RANDOM_STATE

__all__ = [
    "ENCODER_VERSION",
    "HIGH_CARD_MAX",
    "MAX_CAT_LEVELS",
    "RANDOM_STATE",
    "TrainResult",
    "metrics_to_json",
    "train_model",
    "train_model_with_fallback",
    "training_work_frame",
]
