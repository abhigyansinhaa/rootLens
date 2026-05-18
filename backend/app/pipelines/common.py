"""Shared ML types and small helpers to avoid circular imports (canonical location)."""

from __future__ import annotations

from typing import Any, Literal

import pandas as pd

TaskType = Literal["classification", "regression"]


def positive_class_index_for_model(task_type: TaskType, label_encoder: Any | None) -> int:
    """Index of the \"positive\" outcome used for risk / churn explanations.

    Matches ``kpi_engine`` semantics: prefer encoded labels that clearly denote an
    adverse event (``yes``, ``churn``, ``1``, ``true``); otherwise default to
    column 1 so binary ``predict_proba[:, 1]`` stays aligned with common
    lexicographic ``LabelEncoder`` order (e.g. No=0, Yes=1).
    """
    if task_type != "classification" or label_encoder is None:
        return 1
    classes = getattr(label_encoder, "classes_", None)
    if classes is None or len(classes) < 2:
        return 1
    classes_list = [str(c) for c in classes]
    pos_guess = [
        i
        for i, c in enumerate(classes_list)
        if c.lower() in {"1", "true", "yes", "churn"}
    ]
    if pos_guess:
        return int(pos_guess[0])
    return min(1, len(classes_list) - 1)


def detect_task_type(y: pd.Series) -> TaskType:
    if y.dtype == object or str(y.dtype) == "bool" or str(y.dtype) == "category":
        return "classification"
    nu = y.nunique(dropna=True)
    if pd.api.types.is_numeric_dtype(y) and nu <= 20:
        return "classification"
    return "regression"
