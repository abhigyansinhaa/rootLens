"""Audit-consistent UI threshold definitions embedded in analysis reports."""

from __future__ import annotations

from typing import Any

# Green / yellow / red bands for enterprise-facing KPI semantics (additive contract).
UI_THRESHOLDS: dict[str, Any] = {
    "roc_auc": {"green_min": 0.8, "yellow_min": 0.7, "label": "ROC AUC"},
    "churn_rate": {"green_max": 0.1, "yellow_max": 0.2, "label": "Churn / positive rate"},
    "concentration_share": {"green_max": 0.5, "yellow_max": 0.7, "label": "Top-group share of exposure"},
    "high_risk_share": {"green_max": 0.15, "yellow_max": 0.3, "label": "High-risk population share"},
}
