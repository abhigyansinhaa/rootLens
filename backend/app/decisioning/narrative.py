"""Grounded executive narrative from analysis report KPIs."""

from __future__ import annotations

from typing import Any


def _pct(x: float, digits: int = 1) -> str:
    return f"{x * 100:.{digits}f}%"


def _money(n: float) -> str:
    if abs(n) >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    if abs(n) >= 1_000:
        return f"${n / 1_000:.1f}K"
    return f"${n:,.0f}"


def build_narrative(report: dict[str, Any] | None, target: str) -> dict[str, Any]:
    if not report:
        return {"executive_brief": "", "citations": [], "suggested_actions": []}

    kpis = report.get("kpis") or {}
    tl = kpis.get("target_level") or {}
    conc = kpis.get("concentration") or {}
    headline = conc.get("headline") or {}
    ir = kpis.get("impact_revenue") or {}
    drivers = kpis.get("drivers") or []
    rel = kpis.get("reliability") or {}
    di = kpis.get("driver_impact") or {}
    per_driver = di.get("per_driver") or []

    rate = tl.get("predicted_target_rate") if tl.get("predicted_target_rate") is not None else tl.get("target_rate")
    top_pct = headline.get("top_pct_users", 0)
    share = headline.get("share_of_risk", 0)
    revenue = ir.get("revenue_at_risk") if isinstance(ir, dict) else None

    top_driver = drivers[0] if drivers else None
    top_name = top_driver.get("feature") if top_driver else None
    top_stats = next((d for d in per_driver if d.get("feature") == top_name), None) if top_name else None

    citations: list[dict[str, Any]] = [
        {
            "id": 1,
            "label": "Concentration · Pareto",
            "section_id": "concentration-section",
            "confidence": "high" if float(conc.get("gini") or 0) > 0.5 else "medium",
        }
    ]
    if top_driver:
        citations.append(
            {
                "id": 2,
                "label": f"{top_name} · SHAP",
                "section_id": "drivers-section",
                "confidence": (top_stats or {}).get("confidence_tier", "medium"),
            }
        )
    citations.append(
        {
            "id": 3,
            "label": f"Reliability · {rel.get('headline_metric', 'model')}",
            "section_id": "trust-section",
            "confidence": rel.get("tier", "medium"),
        }
    )

    rate_str = _pct(float(rate)) if rate is not None else "an elevated rate"
    if revenue is not None:
        executive_brief = (
            f"Predicted {target} rate is {rate_str}, with {_money(float(revenue))} in modeled exposure. "
            f"The top {top_pct * 100:.0f}% of the population holds {_pct(float(share))} of total risk."
        )
    else:
        executive_brief = (
            f"Predicted {target} rate is {rate_str}. "
            f"The top {top_pct * 100:.0f}% of the population holds {_pct(float(share))} of total modeled exposure."
        )

    concentration_insight = (
        f"Risk is highly concentrated — just {top_pct * 100:.0f}% of users account for "
        f"{_pct(float(share))} of expected exposure."
    )

    driver_insight = None
    action_insight = None
    if top_driver and top_name:
        share_drv = float(top_driver.get("share") or 0)
        driver_insight = f"{top_name} is the primary root cause, explaining {_pct(share_drv, 0)} of feature importance."
        if top_stats:
            rev = top_stats.get("revenue_recoverable")
            delta = top_stats.get("delta_target_rate")
            recover = _money(abs(float(rev))) if rev is not None else _pct(abs(float(delta or 0)))
            action_insight = f"Neutralizing {top_name} could recover up to {recover} in exposure."

    return {
        "executive_brief": executive_brief,
        "concentration_insight": concentration_insight,
        "driver_insight": driver_insight,
        "action_insight": action_insight,
        "citations": citations,
        "suggested_actions": [
            {"label": "Export high-risk segment", "action": "export-segment"},
            {"label": "Run counterfactual", "action": "what-if"},
            {"label": "Download decision brief", "action": "decision-brief"},
        ],
    }
