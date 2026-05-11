"""Risk-segment bucketing (low / medium / high) + tractability score.

Pulled out of the original ``compute_kpis`` body so the KPI engine reads as a
flow of named steps. The math is unchanged.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def build_risk_segments(
    *,
    masks: list[np.ndarray],
    risk_scores: np.ndarray,
    value_arr: np.ndarray,
    has_value_col: bool,
    sv_matrix_full: np.ndarray | None,
    samp_idx_full: np.ndarray | None,
    top_driver_feat_idx: int,
    n_users: int,
) -> list[dict[str, Any]]:
    """Construct the ordered low/medium/high segment list with tractability scores."""
    bucket_labels = ["low", "medium", "high"]
    out: list[dict[str, Any]] = []

    for bi, bm in enumerate(masks):
        count = int(np.sum(bm))
        share_users = float(count / max(n_users, 1))
        val_seg = float(np.sum(value_arr[bm]))
        denom_v = float(np.sum(value_arr))
        value_share = float(val_seg / (denom_v + 1e-15)) if denom_v > 1e-9 else 0.0
        avg_prob = float(np.mean(risk_scores[bm])) if count else 0.0

        lev = 0.0
        if sv_matrix_full is not None and samp_idx_full is not None:
            mask_s = bm[samp_idx_full]
            if np.any(mask_s):
                lev = float(np.mean(np.abs(sv_matrix_full[mask_s, top_driver_feat_idx])))

        tract_raw = lev * (count / max(n_users, 1)) * (1.0 - avg_prob)

        out.append(
            {
                "bucket": bucket_labels[bi],
                "count": count,
                "share": share_users,
                "value": val_seg if has_value_col else None,
                "value_share": value_share if has_value_col else None,
                "avg_proba": avg_prob,
                "avg_top_driver_leverage": lev,
                "tractability_score": float(max(tract_raw, 0.0)),
                "easiest_to_fix": False,
            },
        )

    if out:
        best_i = int(np.argmax([float(r["tractability_score"]) for r in out]))
        for i in range(len(out)):
            out[i]["easiest_to_fix"] = bool(i == best_i)
    return out
