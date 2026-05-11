"""Tests for the `report.governance` block builder."""

from __future__ import annotations

from app.decisioning.governance import (
    GOVERNANCE_COVERAGE_FLOOR,
    build_governance_block,
)


def _basic_kpis(reliability_tier: str = "high", top1_tier: str = "medium") -> dict:
    return {
        "reliability": {
            "tier": reliability_tier,
            "headline_metric": "roc_auc",
            "headline_value": 0.82,
        },
        "driver_impact": {
            "top1": {"confidence_tier": top1_tier},
            "top2": {"confidence_tier": top1_tier},
            "top3": {"confidence_tier": top1_tier},
        },
    }


def test_governance_ok_when_clean():
    block = build_governance_block(
        data_warnings=[],
        fallbacks=[],
        degraded_components=[],
        kpis=_basic_kpis(),
        pipeline_version="1.0",
        encoder_version="v2",
        dataset_hash="abc",
        schema_hash="def",
        dataset_columns=[],
    )
    assert block["status"] == "ok"
    assert block["reasons"] == []
    assert block["warnings"]["total"] == 0


def test_governance_warning_on_leakage_signal():
    block = build_governance_block(
        data_warnings=["Potential leakage: 'leak' correlates with target at |r|=0.99."],
        fallbacks=[],
        degraded_components=[],
        kpis=_basic_kpis(),
        pipeline_version="1.0",
        encoder_version="v2",
        dataset_hash="abc",
        schema_hash="def",
        dataset_columns=[],
    )
    assert block["status"] == "warning"
    assert block["warnings"]["total"] == 1
    assert block["warnings"]["leakage"], block
    assert any("leakage" in r.lower() for r in block["reasons"])


def test_governance_critical_on_low_reliability_overrides_warning():
    block = build_governance_block(
        data_warnings=["Potential leakage: x correlates strongly."],
        fallbacks=[],
        degraded_components=["explanations"],
        kpis=_basic_kpis(reliability_tier="low", top1_tier="low"),
        pipeline_version="1.0",
        encoder_version="v2",
        dataset_hash="abc",
        schema_hash="def",
        dataset_columns=[],
    )
    assert block["status"] == "critical"
    assert any("reliability" in r.lower() for r in block["reasons"])


def test_governance_low_coverage_emits_warning():
    block = build_governance_block(
        data_warnings=[],
        fallbacks=[],
        degraded_components=[],
        kpis=_basic_kpis(),
        pipeline_version="1.0",
        encoder_version="v2",
        dataset_hash="abc",
        schema_hash="def",
        dataset_columns=["a", "b", "c", "d"],
    )
    assert block["feature_governance"]["total_columns"] == 4
    assert block["feature_governance"]["coverage"] == 0.0
    assert block["status"] == "warning"
    assert block["thresholds"]["governance_coverage_floor"] == GOVERNANCE_COVERAGE_FLOOR


def test_governance_classifies_warnings_into_buckets():
    block = build_governance_block(
        data_warnings=[
            "Potential leakage: 'x' correlates with target.",
            "Column 'id' looks identifier-like (high cardinality).",
            "Column 'a' has 70% missing values.",
        ],
        fallbacks=[],
        degraded_components=[],
        kpis=_basic_kpis(),
        pipeline_version=None,
        encoder_version=None,
        dataset_hash=None,
        schema_hash=None,
        dataset_columns=[],
    )
    assert block["warnings"]["by_category"].get("leakage") == 2
    assert block["warnings"]["by_category"].get("data_quality") == 1
