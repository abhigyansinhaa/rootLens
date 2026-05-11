"""InsightEngine: tiny class wrapper around the existing insight builder.

Sister to ``KpiEngine``. Same JSON contract as the legacy ``build_insights``
free function; the class just makes the dependency surface explicit and gives
extensions a clean seam (additional governance signals, future rule packs).
No plugin registry, no DI container — direct construction only.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.decisioning.insights import (
    ConfidenceLevel,
    build_insights as _build_insights_impl,
    insights_to_json as _insights_to_json_impl,
)
from app.pipelines.common import TaskType


class InsightEngine:
    """Compose ranked SHAP rows + raw column metadata into operator narratives."""

    def __init__(self, *, top_n: int = 8) -> None:
        self.top_n = int(top_n)

    def build(
        self,
        *,
        df: pd.DataFrame,
        target: str,
        task_type: TaskType,
        shap_rows: list[dict[str, Any]],
        column_meta: list[dict[str, Any]],
        confidence: ConfidenceLevel = "medium",
        explanation_stability: str | None = None,
    ) -> list[dict[str, Any]]:
        return _build_insights_impl(
            df=df,
            target=target,
            task_type=task_type,
            shap_rows=shap_rows,
            column_meta=column_meta,
            top_n=self.top_n,
            confidence=confidence,
            explanation_stability=explanation_stability,
        )

    def to_json(self, insights: list[dict[str, Any]]) -> str:
        return _insights_to_json_impl(insights)
