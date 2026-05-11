"""Counterfactual confidence assessment for the KPI engine.

A SHAP-zeroing counterfactual ("turn off feature X and see how predictions
move") is only as trustworthy as the feature's importance is stable across
rows AND the underlying model is reliable. This module tags every per-driver
entry in ``driver_impact`` with a ``confidence_tier`` ∈ {high, medium, low}
so the UI can downweight noisy counterfactuals instead of presenting them as
crisp policy levers.

Design:
* ``DriverImpactStats`` captures the inputs we evaluate per feature: SHAP
  matrix slice, row support, reliability tier.
* ``assess_driver_confidence`` returns the tier and the underlying signals
  (cv_ratio, support, reliability) so they round-trip into the report and can
  be surfaced in the governance block.
* ``annotate_driver_impact`` mutates a ``driver_impact`` dict in place,
  appending the same shape to per-driver / top1 / top2 / top3 entries. The
  legacy fields stay untouched — additive only, JSON contract preserved.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Literal

import numpy as np

ConfidenceTier = Literal["high", "medium", "low"]


# Thresholds intentionally tuned to be forgiving: we want "high" to mean
# "operator can act on this number"; "low" means "use as direction, not
# magnitude". Anything in between lands on "medium".
HIGH_CV_RATIO_MAX = 0.85
MEDIUM_CV_RATIO_MAX = 1.6
HIGH_SUPPORT_MIN = 0.05
MEDIUM_SUPPORT_MIN = 0.01


@dataclass
class DriverImpactStats:
    feature: str
    cv_ratio: float   # std(|phi|) / (mean(|phi|) + eps)
    support: float    # fraction of rows where |phi| is materially non-zero
    reliability_tier: ConfidenceTier


def _safe_cv_ratio(phi_col: np.ndarray) -> float:
    """Coefficient of variation of |SHAP| across rows; lower is more stable."""
    arr = np.abs(np.asarray(phi_col, dtype=float))
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return float("inf")
    mean = float(np.mean(arr))
    if mean <= 1e-12:
        return float("inf")
    return float(np.std(arr) / (mean + 1e-12))


def _support(phi_col: np.ndarray) -> float:
    """Fraction of rows where |SHAP| is at least 10% of the per-row max impact.

    Using a within-row threshold avoids penalizing features that are
    consistently moderate-but-real drivers. Falls back to 0 on degenerate inputs.
    """
    arr = np.abs(np.asarray(phi_col, dtype=float))
    if arr.size == 0:
        return 0.0
    row_max = float(np.percentile(arr, 95)) or float(np.max(arr))
    if row_max <= 1e-12:
        return 0.0
    return float(np.mean(arr >= 0.10 * row_max))


def assess_driver_confidence(stats: DriverImpactStats) -> dict[str, Any]:
    """Return ``{confidence_tier, confidence_signals}`` for one driver entry."""
    cv = stats.cv_ratio
    sp = stats.support
    rel = stats.reliability_tier

    tier: ConfidenceTier
    if rel == "high" and cv <= HIGH_CV_RATIO_MAX and sp >= HIGH_SUPPORT_MIN:
        tier = "high"
    elif rel == "low":
        tier = "low"
    elif cv > MEDIUM_CV_RATIO_MAX or sp < MEDIUM_SUPPORT_MIN:
        tier = "low"
    else:
        tier = "medium"

    return {
        "confidence_tier": tier,
        "confidence_signals": {
            "cv_ratio": float(cv) if np.isfinite(cv) else None,
            "support": float(sp),
            "reliability_tier": rel,
        },
    }


def _aggregate_tier(tiers: Iterable[ConfidenceTier]) -> ConfidenceTier:
    """Worst-case across the constituents: a rollup is no stronger than its weakest part."""
    order = {"high": 2, "medium": 1, "low": 0}
    items = list(tiers)
    if not items:
        return "low"
    return min(items, key=lambda t: order.get(t, 0))


def annotate_driver_impact(
    driver_impact: dict[str, Any],
    *,
    feats_topk: list[tuple[str, int]],
    sv_matrix: np.ndarray | None,
    reliability_tier: ConfidenceTier,
) -> None:
    """Decorate ``driver_impact`` per-driver / top-k entries with confidence tiers.

    No-op-safe: when SHAP is unavailable (linear-share approximation), we fall
    back to the reliability tier alone — the field is still present so the
    frontend can render it consistently.
    """
    per_driver: list[dict[str, Any]] = list(driver_impact.get("per_driver", []))
    tier_by_feature: dict[str, ConfidenceTier] = {}

    if sv_matrix is None or not feats_topk:
        for entry in per_driver:
            decision = assess_driver_confidence(
                DriverImpactStats(
                    feature=str(entry["feature"]),
                    cv_ratio=float("inf"),
                    support=0.0,
                    reliability_tier=reliability_tier,
                )
            )
            entry.update(decision)
            tier_by_feature[str(entry["feature"])] = decision["confidence_tier"]
    else:
        feat_to_idx = {name: idx for name, idx in feats_topk}
        for entry in per_driver:
            name = str(entry["feature"])
            idx = feat_to_idx.get(name)
            if idx is None:
                stats = DriverImpactStats(
                    feature=name,
                    cv_ratio=float("inf"),
                    support=0.0,
                    reliability_tier=reliability_tier,
                )
            else:
                col = sv_matrix[:, idx]
                stats = DriverImpactStats(
                    feature=name,
                    cv_ratio=_safe_cv_ratio(col),
                    support=_support(col),
                    reliability_tier=reliability_tier,
                )
            decision = assess_driver_confidence(stats)
            entry.update(decision)
            tier_by_feature[name] = decision["confidence_tier"]

    driver_impact["per_driver"] = per_driver

    ordered_features = [name for name, _ in feats_topk] if feats_topk else [
        str(e["feature"]) for e in per_driver
    ]
    for k_label, k in (("top1", 1), ("top2", 2), ("top3", 3)):
        rollup = driver_impact.get(k_label)
        if not isinstance(rollup, dict):
            continue
        slice_tiers = [tier_by_feature[f] for f in ordered_features[:k] if f in tier_by_feature]
        rollup["confidence_tier"] = _aggregate_tier(slice_tiers) if slice_tiers else "low"
