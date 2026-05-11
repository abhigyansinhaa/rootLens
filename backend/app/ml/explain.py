"""Back-compat shim: canonical implementation lives at `app.pipelines.explain`."""

from app.pipelines.explain import *  # noqa: F401,F403
from app.pipelines.explain import (  # noqa: F401
    MAX_SHAP_SAMPLES,
    SHAP_COMPUTE_MIN_SAMPLE,
    SHAP_COMPUTE_SAMPLE_CAP,
    SHAP_PLOT_SAMPLE_CAP,
    compute_explanations,
    compute_explanations_with_fallback,
    shap_compute_sample_size,
    shap_json_dump,
    shap_plot_sample_size,
)

__all__ = [
    "MAX_SHAP_SAMPLES",
    "SHAP_COMPUTE_MIN_SAMPLE",
    "SHAP_COMPUTE_SAMPLE_CAP",
    "SHAP_PLOT_SAMPLE_CAP",
    "compute_explanations",
    "compute_explanations_with_fallback",
    "shap_compute_sample_size",
    "shap_json_dump",
    "shap_plot_sample_size",
]
