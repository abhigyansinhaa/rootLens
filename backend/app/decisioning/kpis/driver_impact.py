"""Driver-impact helpers (SHAP zeroing + linear-share approximation)."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.pipelines.common import TaskType


def sigmoid_vec(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))


def feat_index(feat_names: list[str], name: str) -> int | None:
    if name in feat_names:
        return feat_names.index(name)
    return None


def roll_topk(
    cum_phi: np.ndarray,
    sv_base_val: float,
    feat_topk_indices: list[int],
    k: int,
    task_type: TaskType,
    value_samp: np.ndarray | None,
) -> dict[str, Any]:
    """Aggregate SHAP-zeroing counterfactual over the top-k drivers.

    Returns the JSON-shaped ``{delta_target_rate, users_savable, revenue_recoverable}``
    dict consumed by the KPI engine's ``driver_impact`` block.
    """
    mats = cum_phi.copy()
    kk = min(k, len(feat_topk_indices))
    for t in range(kk):
        jj = feat_topk_indices[t]
        mats[:, jj] = 0.0
    if task_type == "classification":
        pb = sv_base_val + np.sum(cum_phi, axis=1)
        pa = sv_base_val + np.sum(mats, axis=1)
        pb_p = sigmoid_vec(pb)
        pa_p = sigmoid_vec(pa)
        dtr_roll = float(np.mean(pa_p - pb_p))
        us = int(np.sum((pb_p >= 0.7) & (pa_p < 0.3)))
        rr: float | None = None
        if value_samp is not None and len(value_samp) == len(pa_p):
            rr = float(np.sum(value_samp * (pb_p - pa_p)))
        return {"delta_target_rate": float(-dtr_roll), "users_savable": us, "revenue_recoverable": rr}
    pred_full = sv_base_val + np.sum(cum_phi, axis=1)
    pred_alt = sv_base_val + np.sum(mats, axis=1)
    mean_abs = float(np.mean(np.abs(pred_full - pred_alt)))
    scale = float(np.mean(np.abs(pred_full)) + 1e-9)
    dtr_roll = mean_abs / scale
    rr = None
    if value_samp is not None and len(value_samp) == len(pred_full):
        rr = float(np.sum(np.abs(value_samp * (pred_full - pred_alt))))
    return {"delta_target_rate": float(dtr_roll), "users_savable": 0, "revenue_recoverable": rr}
