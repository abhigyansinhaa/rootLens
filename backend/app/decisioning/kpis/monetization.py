"""Revenue / value-at-risk roll-ups for the KPI engine."""

from __future__ import annotations

from typing import Any

import numpy as np


def classification_impact_revenue(
    *,
    risk_scores: np.ndarray,
    value_arr: np.ndarray,
    high_mask: np.ndarray,
) -> dict[str, Any]:
    rev_at_risk = float(np.sum(value_arr[risk_scores >= 0.5]))
    pot_saved = float(np.sum(risk_scores * value_arr))
    return {
        "total_value": float(np.sum(value_arr)),
        "revenue_at_risk": rev_at_risk,
        "potential_revenue_saved": pot_saved,
        "avg_value_high_risk": float(np.mean(value_arr[high_mask]) if np.any(high_mask) else 0.0),
        "currency": None,
    }


def regression_impact_revenue(
    *,
    pred_vals: np.ndarray,
    value_arr: np.ndarray,
    high_mask: np.ndarray,
) -> dict[str, Any]:
    pred_pos_m = pred_vals >= np.median(pred_vals)
    return {
        "total_value": float(np.sum(value_arr)),
        "revenue_at_risk": float(np.sum(value_arr[pred_pos_m])),
        "potential_revenue_saved": float(np.sum(np.maximum(pred_vals, 0.0) * value_arr)),
        "avg_value_high_risk": float(np.mean(value_arr[high_mask]) if np.any(high_mask) else 0.0),
        "currency": None,
    }
