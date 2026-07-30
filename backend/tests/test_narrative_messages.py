"""Direct tests for the copy-generation layer: narrative.py, messages.py, kpi_trust_copy.py.

These modules produce user-facing text — executive briefs, disclaimers, failure
messages, degradation notes. Indirect coverage via test_insights.py is
insufficient to catch wording regressions, missing citations, or truncated
messages. This file tests the sentence framing, citation structure, and edge
cases (empty/None reports, missing drivers) directly.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.decisioning.kpi_trust_copy import (
    CORRELATION_NOT_CAUSATION_SHORT,
    COUNTERFACTUAL_CAUSAL_DISCLAIMER,
    ROI_ASSUMPTIONS_CLIENT_ONLY,
)
from app.decisioning.messages import (
    GOODWILL_EXPLANATION_FALLBACK,
    GOODWILL_FAILURE_SHORT,
    GOODWILL_FAILURE_SUPPORT,
    GOODWILL_PARTIAL,
    GOODWILL_PLOT_SKIPPED,
    GOODWILL_TRAINING_FALLBACK,
    combined_user_message,
    failure_message_for_user,
)
from app.decisioning.narrative import build_narrative


# ===================================================================
# 1. messages.py — combined_user_message
# ===================================================================

class TestCombinedUserMessage:
    def test_returns_none_when_no_fallbacks(self):
        assert combined_user_message([]) is None

    def test_blank_only_list_returns_none(self):
        """When all notes are blank strings, the function correctly filters them
        out and returns None, rather than prepending the GOODWILL_PARTIAL prefix."""
        msg = combined_user_message(["", "  ", ""])
        assert msg is None

    def test_includes_goodwill_partial_prefix(self):
        msg = combined_user_message(["Model fell back to RF."])
        assert msg is not None
        assert GOODWILL_PARTIAL in msg

    def test_includes_fallback_notes(self):
        notes = ["Model fell back to RF.", "SHAP plots simplified."]
        msg = combined_user_message(notes)
        assert "Model fell back to RF." in msg
        assert "SHAP plots simplified." in msg

    def test_deduplicates_repeated_notes(self):
        notes = ["Same note.", "Same note.", "Same note."]
        msg = combined_user_message(notes)
        assert msg is not None
        # The note should appear exactly once (plus the goodwill prefix)
        assert msg.count("Same note.") == 1

    def test_caps_at_four_notes(self):
        notes = [f"Note {i}." for i in range(10)]
        msg = combined_user_message(notes)
        assert msg is not None
        # Goodwill partial + up to 4 notes
        parts = msg.split(" ")
        assert "Note 5." not in msg  # 5th unique note (0-indexed) should be cut


# ===================================================================
# 2. messages.py — failure_message_for_user
# ===================================================================

class TestFailureMessageForUser:
    def test_base_message_without_technical(self):
        msg = failure_message_for_user()
        assert GOODWILL_FAILURE_SHORT in msg
        assert GOODWILL_FAILURE_SUPPORT in msg

    def test_includes_short_technical_detail(self):
        msg = failure_message_for_user("Target column not found")
        assert "Target column not found" in msg

    def test_rejects_multiline_technical_detail(self):
        msg = failure_message_for_user("line1\nline2")
        assert "line1" not in msg  # Multiline is stripped

    def test_rejects_long_technical_detail(self):
        msg = failure_message_for_user("x" * 250)
        assert "x" * 250 not in msg

    def test_never_contains_stack_trace_patterns(self):
        msg = failure_message_for_user("Traceback (most recent call last)")
        # Technical detail too long or has newlines — should be excluded
        assert "Traceback" not in msg or len("Traceback (most recent call last)") < 200


# ===================================================================
# 3. kpi_trust_copy.py — Constants are non-empty, well-formed
# ===================================================================

class TestTrustCopyConstants:
    def test_counterfactual_disclaimer_nonempty(self):
        assert len(COUNTERFACTUAL_CAUSAL_DISCLAIMER) > 30
        assert "causal" in COUNTERFACTUAL_CAUSAL_DISCLAIMER.lower()

    def test_correlation_not_causation_nonempty(self):
        assert len(CORRELATION_NOT_CAUSATION_SHORT) > 20
        assert "causation" in CORRELATION_NOT_CAUSATION_SHORT.lower()

    def test_roi_assumptions_nonempty(self):
        assert len(ROI_ASSUMPTIONS_CLIENT_ONLY) > 20
        assert "ROI" in ROI_ASSUMPTIONS_CLIENT_ONLY

    def test_goodwill_constants_all_end_with_period(self):
        """User-facing copy should end with punctuation."""
        for label, text in [
            ("GOODWILL_PARTIAL", GOODWILL_PARTIAL),
            ("GOODWILL_TRAINING_FALLBACK", GOODWILL_TRAINING_FALLBACK),
            ("GOODWILL_EXPLANATION_FALLBACK", GOODWILL_EXPLANATION_FALLBACK),
            ("GOODWILL_PLOT_SKIPPED", GOODWILL_PLOT_SKIPPED),
            ("GOODWILL_FAILURE_SHORT", GOODWILL_FAILURE_SHORT),
            ("GOODWILL_FAILURE_SUPPORT", GOODWILL_FAILURE_SUPPORT),
        ]:
            assert text.rstrip().endswith("."), f"{label} doesn't end with period"


# ===================================================================
# 4. narrative.py — build_narrative
# ===================================================================

def _sample_report(
    *,
    target_rate: float = 0.15,
    revenue_at_risk: float | None = 50000.0,
    gini: float = 0.55,
    top_driver: str = "MonthlyCharges",
    top_share: float = 0.35,
    reliability_tier: str = "high",
    driver_delta: float = 0.04,
    driver_revenue: float | None = 12000.0,
) -> dict[str, Any]:
    """Build a minimal report dict that exercises build_narrative paths."""
    per_driver = [
        {
            "feature": top_driver,
            "delta_target_rate": driver_delta,
            "revenue_recoverable": driver_revenue,
            "confidence_tier": "medium",
        }
    ]
    return {
        "kpis": {
            "target_level": {
                "predicted_target_rate": target_rate,
                "target_rate": target_rate,
                "n_users": 1000,
                "high_risk_count": 150,
                "high_risk_share": 0.15,
            },
            "concentration": {
                "gini": gini,
                "headline": {"top_pct_users": 0.20, "share_of_risk": 0.72},
            },
            "impact_revenue": (
                {"revenue_at_risk": revenue_at_risk, "total_value": 100000.0, "potential_revenue_saved": 30000.0}
                if revenue_at_risk is not None
                else None
            ),
            "drivers": [{"feature": top_driver, "mean_abs_shap": 0.5, "share": top_share}],
            "reliability": {
                "tier": reliability_tier,
                "headline_metric": "roc_auc",
                "headline_value": 0.82,
                "score": 0.78,
            },
            "driver_impact": {
                "per_driver": per_driver,
                "top1": {"delta_target_rate": driver_delta, "confidence_tier": "medium"},
            },
        }
    }


class TestBuildNarrative:
    def test_returns_empty_for_none_report(self):
        result = build_narrative(None, "churn")
        assert result["executive_brief"] == ""
        assert result["citations"] == []
        assert result["suggested_actions"] == []

    def test_returns_empty_for_empty_report(self):
        result = build_narrative({}, "churn")
        assert result["executive_brief"] == ""

    def test_executive_brief_mentions_target(self):
        report = _sample_report()
        result = build_narrative(report, "churn")
        assert "churn" in result["executive_brief"].lower()

    def test_executive_brief_includes_rate(self):
        report = _sample_report(target_rate=0.27)
        result = build_narrative(report, "churn")
        assert "27" in result["executive_brief"]  # "27.0%" or similar

    def test_executive_brief_with_revenue(self):
        report = _sample_report(revenue_at_risk=1_500_000)
        result = build_narrative(report, "churn")
        assert "$" in result["executive_brief"]
        assert "1.5M" in result["executive_brief"]

    def test_executive_brief_without_revenue(self):
        report = _sample_report(revenue_at_risk=None)
        result = build_narrative(report, "churn")
        assert "executive_brief" in result
        assert len(result["executive_brief"]) > 0
        # Should still mention concentration
        assert "%" in result["executive_brief"]

    def test_citations_structure(self):
        report = _sample_report()
        result = build_narrative(report, "churn")
        citations = result["citations"]
        assert len(citations) >= 2
        for c in citations:
            assert "id" in c
            assert "label" in c
            assert "section_id" in c
            assert "confidence" in c

    def test_citations_include_concentration_and_reliability(self):
        report = _sample_report()
        result = build_narrative(report, "churn")
        labels = [c["label"] for c in result["citations"]]
        assert any("Concentration" in l or "Pareto" in l for l in labels)
        assert any("Reliability" in l for l in labels)

    def test_driver_insight_mentions_top_driver(self):
        report = _sample_report(top_driver="Contract")
        result = build_narrative(report, "churn")
        assert result["driver_insight"] is not None
        assert "Contract" in result["driver_insight"]

    def test_action_insight_mentions_recovery(self):
        report = _sample_report(driver_revenue=25000.0)
        result = build_narrative(report, "churn")
        if result["action_insight"]:
            assert "$" in result["action_insight"] or "%" in result["action_insight"]

    def test_suggested_actions_always_present(self):
        report = _sample_report()
        result = build_narrative(report, "churn")
        actions = result["suggested_actions"]
        assert len(actions) >= 2
        action_types = {a["action"] for a in actions}
        assert "export-segment" in action_types
        assert "what-if" in action_types

    def test_concentration_insight_present(self):
        report = _sample_report()
        result = build_narrative(report, "churn")
        assert "concentration_insight" in result
        assert "%" in result["concentration_insight"]

    def test_money_formatting_thousands(self):
        report = _sample_report(revenue_at_risk=5500)
        result = build_narrative(report, "churn")
        assert "$5.5K" in result["executive_brief"]

    def test_money_formatting_millions(self):
        report = _sample_report(revenue_at_risk=2_300_000)
        result = build_narrative(report, "churn")
        assert "$2.3M" in result["executive_brief"]

    def test_no_drivers_still_produces_brief(self):
        report = _sample_report()
        report["kpis"]["drivers"] = []
        report["kpis"]["driver_impact"]["per_driver"] = []
        result = build_narrative(report, "churn")
        assert len(result["executive_brief"]) > 0
        assert result["driver_insight"] is None
        assert result["action_insight"] is None
