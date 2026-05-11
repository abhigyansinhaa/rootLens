"""Back-compat shim: canonical implementation lives at `app.decisioning.insights`."""

from app.decisioning.insights import *  # noqa: F401,F403
from app.decisioning.insights import (  # noqa: F401
    aggregate_shap_by_column,
    build_insights,
    insights_to_json,
)

__all__ = ["aggregate_shap_by_column", "build_insights", "insights_to_json"]
