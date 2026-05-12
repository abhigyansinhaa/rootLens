"""Reliability headline + tier + user-facing hint for the KPI engine."""

from __future__ import annotations

from typing import Any

from app.pipelines.common import TaskType


def reliability_block(
    metrics: dict[str, float],
    cv_metrics: dict[str, float],
    task_type: TaskType,
) -> dict[str, Any]:
    cv_std: float | None = None
    hint = "Predictions look reasonably stable for interpretation."
    if task_type == "classification":
        if metrics.get("roc_auc"):
            headline_value = float(metrics["roc_auc"])
            headline_metric = "roc_auc"
        else:
            headline_value = float(0.5 * metrics.get("accuracy", 0) + 0.5 * metrics.get("f1_macro", 0))
            headline_metric = "blend"
        if "cv_accuracy_std" in cv_metrics:
            cv_std = float(cv_metrics["cv_accuracy_std"])
            if cv_std > 0.15:
                hint = "Cross-validation accuracy varies across folds — drivers may shift on retraining."
        score = min(1.0, headline_value * (1.0 - min(cv_std or 0, 0.3) / 0.35))
        if headline_metric != "roc_auc":
            score = headline_value * 0.85 * (1.0 - min(cv_std or 0, 0.3) / 0.35)
        roc_plain = (
            "ROC AUC measures how well predicted risk ranks churners above non-churners; "
            "higher means cleaner separation on the holdout fold."
            if headline_metric == "roc_auc"
            else "Headline score blends accuracy and F1 when ROC AUC is unavailable."
        )
        cv_plain = (
            "Cross-validation spread is modest — estimated driver rankings should be relatively stable across resamples."
            if cv_std is not None and cv_std <= 0.08
            else "Cross-validation variance is noticeable — expect some driver reordering if you retrain."
            if cv_std is not None
            else "Fold-to-fold variance was not estimated for this run."
        )
        business_explanation = f"{roc_plain} {cv_plain}"
    else:
        headline_value = float(metrics.get("r2", -0.5))
        headline_metric = "r2"
        if "cv_r2_std" in cv_metrics:
            cv_std = float(cv_metrics["cv_r2_std"])
            if cv_std > 0.2:
                hint = "Cross-validation R² varies across folds — drivers may shift on retraining."
        score = max(0.0, min(1.0, (headline_value + 0.5) / 1.5)) * (1.0 - min(cv_std or 0, 0.45) / 0.55)
        business_explanation = (
            "R² summarizes how much variance in the target the model explains on the holdout fold. "
            "Negative or very low values mean the model is barely better than predicting the average."
        )

    if score >= 0.65:
        tier = "high"
    elif score >= 0.4:
        tier = "medium"
    else:
        tier = "low"

    return {
        "score": float(score),
        "tier": tier,
        "headline_metric": headline_metric,
        "headline_value": float(headline_value),
        "cv_std": cv_std,
        "hint": hint,
        "business_explanation": business_explanation,
    }
