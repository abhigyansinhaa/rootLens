"""Rule-based business recommendations from SHAP and data quality."""

from __future__ import annotations

from typing import Any, Literal

TaskType = Literal["classification", "regression"]
ConfidenceLevel = Literal["high", "medium", "low"]


def build_recommendations(
    task_type: TaskType,
    target: str,
    shap_rows: list[dict[str, Any]],
    column_meta: list[dict[str, Any]],
    metrics: dict[str, float],
    confidence: ConfidenceLevel = "medium",
    model_kind: str = "xgboost",
    validation_strategy: str = "holdout",
    top_k: int = 6,
) -> list[str]:
    recs: list[str] = []

    recs.append(
        "Outputs are associative (model-based), not proven causal effects. Use with domain knowledge."
    )

    if task_type == "classification":
        acc = metrics.get("accuracy", 0)
        recs.append(
            f"Hold-out accuracy is {acc:.1%} ({validation_strategy}). "
            f"Model family: {model_kind}. Confidence label: {confidence}."
        )
    else:
        r2 = metrics.get("r2", 0)
        recs.append(
            f"Hold-out R² is {r2:.3f} ({validation_strategy}). "
            f"Model family: {model_kind}. Confidence label: {confidence}."
        )

    if confidence == "low":
        recs.append(
            "Low confidence: prioritize data collection and validation before operational changes based on drivers."
        )

    ranked = sorted(shap_rows, key=lambda r: -r["mean_abs_shap"])[:top_k]
    for r in ranked:
        feat = r["feature"]
        mag = r["mean_abs_shap"]
        direction = r["direction"]
        if direction == "increases":
            recs.append(
                f"Operational lever: strategies that increase '{feat}' are associated with higher predicted '{target}' "
                f"(approx. importance {mag:.3f}). Pilot interventions and measure '{target}'."
            )
        else:
            recs.append(
                f"Risk / efficiency: higher '{feat}' is associated with lower predicted '{target}' "
                f"(importance {mag:.3f}). Investigate processes affecting this driver."
            )

    meta_by_name = {m["name"]: m for m in column_meta}
    for name, m in meta_by_name.items():
        if m.get("null_ratio", 0) > 0.3:
            recs.append(
                f"Data quality: '{name}' is missing ~{m['null_ratio']*100:.0f}% of the time — backfill or source "
                "cleaner data before locking in decisions on this field."
            )

    if len(ranked) >= 2 and len({r["feature"].split("_")[0] for r in ranked[:3]}) >= 2:
        recs.append(
            "Segment deep-dive: top drivers span multiple factors — consider segmenting by "
            f"'{ranked[0]['feature']}' and '{ranked[1]['feature']}' for tailored playbooks."
        )

    return recs[:14]
