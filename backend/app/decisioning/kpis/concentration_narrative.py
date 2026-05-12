"""Operational language for concentration / Pareto KPIs."""

from __future__ import annotations

from typing import Any


def concentration_interpretation(
    *,
    top_pct_users: float,
    share_of_risk: float,
    gini: float,
    n_users: int,
) -> str:
    pct_u = int(round(float(top_pct_users) * 100))
    pct_r = int(round(float(share_of_risk) * 100))
    g = float(gini)
    return (
        f"A small slice of customers — the top {pct_u}% by modeled exposure — accounts for about "
        f"{pct_r}% of total expected risk across {n_users:,} rows. "
        f"Concentration (Gini {g:.2f}) is "
        f"{'high' if g >= 0.55 else 'moderate' if g >= 0.35 else 'relatively low'}; "
        "retention and save-triage programs should prioritize that tail before broad campaigns."
    )


def pareto_cut_table(
    *,
    lorenz_points: list[dict[str, float]],
    n_users: int,
    revenue_at_risk: float | None,
) -> list[dict[str, Any]]:
    """Per-cut user counts and rough revenue exposure (linear in share_of_risk)."""
    out: list[dict[str, Any]] = []
    for p in lorenz_points:
        x = float(p.get("x", 0))
        y = float(p.get("y", 0))
        approx_users = max(1, int(round(x * n_users)))
        approx_revenue = float(revenue_at_risk) * y if revenue_at_risk is not None else None
        out.append(
            {
                "top_pct": x,
                "share_of_risk": y,
                "approx_users": approx_users,
                "approx_revenue_at_risk": approx_revenue,
            }
        )
    return out
