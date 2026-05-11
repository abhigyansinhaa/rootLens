"""Root-cause style insights from SHAP-ranked features with grouping and confidence."""

from __future__ import annotations

import json
from typing import Any, Literal

import numpy as np
import pandas as pd

from app.pipelines.common import TaskType

ConfidenceLevel = Literal["high", "medium", "low"]


def _base_column_name(feature: str) -> str:
    # One-hot column: prefix_rest — map to prefix (first segment)
    if "_" in feature:
        return feature.split("_", 1)[0]
    return feature


def aggregate_shap_by_column(
    shap_rows: list[dict[str, Any]],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """Sum mean_abs_shap for dummy columns sharing the same stem (e.g. cat prefix)."""
    from collections import defaultdict

    agg_abs: dict[str, float] = defaultdict(float)
    agg_signed: dict[str, float] = defaultdict(float)
    for r in shap_rows:
        name = r["feature"]
        stem = _base_column_name(name)
        agg_abs[stem] += r["mean_abs_shap"]
        agg_signed[stem] += r["mean_signed_shap"]

    combined = [
        {
            "feature": k,
            "mean_abs_shap": v,
            "mean_signed_shap": agg_signed[k],
            "direction": "increases" if agg_signed[k] >= 0 else "decreases",
        }
        for k, v in sorted(agg_abs.items(), key=lambda x: -x[1])
    ]
    return combined[:top_k]


def build_insights(
    df: pd.DataFrame,
    target: str,
    task_type: TaskType,
    shap_rows: list[dict[str, Any]],
    column_meta: list[dict[str, Any]],
    top_n: int = 8,
    confidence: ConfidenceLevel = "medium",
    explanation_stability: str | None = None,
) -> list[dict[str, Any]]:
    """Correlation / SHAP-based insight strings with confidence tagging."""
    meta_by_name = {m["name"]: m for m in column_meta}
    ranked = sorted(shap_rows, key=lambda r: -r["mean_abs_shap"])[:top_n]
    insights: list[dict[str, Any]] = []

    y = df[target]
    for r in ranked:
        fname = r["feature"]
        stem = _base_column_name(fname)
        direction = r["direction"]
        strength = r["mean_abs_shap"]

        conf_note = "Strong" if confidence == "high" else "Moderate" if confidence == "medium" else "Tentative"
        text = (
            f"{conf_note} driver: '{stem}' is among the strongest modeled associations with '{target}' "
            f"(mean |importance| ≈ {strength:.4f}). Higher encoded values tend to {direction} the predicted outcome."
        )

        if stem in df.columns and pd.api.types.is_numeric_dtype(df[stem]):
            try:
                sub = df[[stem, target]].dropna()
                if len(sub) > 5:
                    corr = sub[stem].corr(pd.to_numeric(sub[target], errors="coerce"))
                    if corr is not None and not np.isnan(corr):
                        text += f" Raw correlation with '{target}' is {corr:+.3f}."
            except Exception:
                pass

        if stem in meta_by_name and meta_by_name[stem].get("null_ratio", 0) > 0.3:
            text += (
                f" Note: '{stem}' has ~{meta_by_name[stem]['null_ratio']*100:.0f}% missing values; "
                "treat this driver as less reliable until data quality improves."
            )

        if explanation_stability:
            text += f" Note: {explanation_stability}"

        insights.append(
            {
                "feature": fname,
                "grouped_feature": stem,
                "kind": "driver",
                "task_type": task_type,
                "summary": text,
                "mean_abs_shap": strength,
                "confidence": confidence,
            }
        )

    return insights


def insights_to_json(insights: list[dict[str, Any]]) -> str:
    return json.dumps(insights)
