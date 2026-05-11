"""Concentration / Pareto / Lorenz helpers used by the KPI engine.

Extracted verbatim from the original `decisioning/kpis.py` so the public JSON
contract stays byte-identical. Functions are pure: they consume numpy arrays
and return primitives + small dicts.
"""

from __future__ import annotations

import numpy as np


def gini_nonnegative(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x) & (x >= 0)]
    if x.size < 2:
        return 0.0
    s = float(np.sum(x))
    if s <= 0:
        return 0.0
    x_sorted = np.sort(x)
    n = x_sorted.size
    idx = np.arange(1, n + 1, dtype=float)
    return float((2.0 * np.sum(idx * x_sorted) / (n * s)) - (n + 1.0) / n)


def top_risk_share(losses: np.ndarray, top_frac: float) -> float:
    losses = np.asarray(losses, dtype=float)
    if losses.size == 0:
        return 0.0
    k = max(1, int(np.ceil(losses.size * top_frac)))
    part = np.sort(losses)[-k:]
    total = float(np.sum(losses))
    if total <= 0:
        return 0.0
    return float(np.sum(part) / total)


def concentration_headline(losses: np.ndarray) -> tuple[dict[str, float], list[dict[str, float]]]:
    """Return ({top_pct_users, share_of_risk}, lorenz_points)."""
    candidates = [0.05, 0.10, 0.18, 0.20, 0.25, 0.50]
    headline = {"top_pct_users": 0.20, "share_of_risk": float(top_risk_share(losses, 0.20))}
    for x in candidates:
        sh = top_risk_share(losses, x)
        if sh >= 0.70:
            headline = {"top_pct_users": float(x), "share_of_risk": float(sh)}
            break
    lorenz_points = [{"x": float(p), "y": float(top_risk_share(losses, p))} for p in [0.05, 0.10, 0.20, 0.50]]
    return headline, lorenz_points
