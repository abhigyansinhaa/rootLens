"""Shared ML types and small helpers to avoid circular imports (canonical location)."""

from __future__ import annotations

from typing import Literal

import pandas as pd

TaskType = Literal["classification", "regression"]


def detect_task_type(y: pd.Series) -> TaskType:
    if y.dtype == object or str(y.dtype) == "bool" or str(y.dtype) == "category":
        return "classification"
    nu = y.nunique(dropna=True)
    if pd.api.types.is_numeric_dtype(y) and nu <= 20:
        return "classification"
    return "regression"
