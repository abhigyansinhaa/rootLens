"""Intervention confidence: distinct from model reliability (causal / operational readiness)."""

from __future__ import annotations

from typing import Any, Literal

ConfidenceTier = Literal["high", "medium", "low"]

_ORDER = {"high": 2, "medium": 1, "low": 0}


def _min_tier(*tiers: ConfidenceTier | str | None) -> ConfidenceTier:
    items = [t for t in tiers if t in _ORDER]
    if not items:
        return "low"
    return min(items, key=lambda t: _ORDER[str(t)])


def build_intervention_confidence(
    *,
    reliability_tier: ConfidenceTier,
    driver_impact: dict[str, Any],
    approximation: str,
    data_warning_count: int = 0,
) -> dict[str, Any]:
    """Down-rank actionable trust when SHAP is unstable, approximated, or data is noisy."""
    per = list(driver_impact.get("per_driver") or [])
    tiers = [str(r.get("confidence_tier") or "low") for r in per if isinstance(r, dict)]
    base = _min_tier(reliability_tier, *tiers) if tiers else str(reliability_tier)

    tier: ConfidenceTier = base  # type: ignore[assignment]
    if approximation != "shap_zeroing":
        tier = _min_tier(tier, "medium")
    if data_warning_count >= 4:
        tier = _min_tier(tier, "low")
    elif data_warning_count >= 2:
        tier = _min_tier(tier, "medium")

    bullets: list[str] = []
    if approximation != "shap_zeroing":
        bullets.append("Scenario math uses importance shares instead of full SHAP zero-out — treat lift as directional.")
    if reliability_tier == "low":
        bullets.append("Model reliability is low; prioritize cheap tests before scaling interventions.")
    if data_warning_count:
        bullets.append(f"{data_warning_count} data-quality signal(s) were raised during training — validate drivers in-source.")
    if not bullets:
        bullets.append("Intervention estimates lean on associative model evidence — confirm with ops pilots where stakes are high.")

    return {
        "tier": tier,
        "rationale_bullets": bullets[:5],
    }
