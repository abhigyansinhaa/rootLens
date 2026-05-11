"""Tests for counterfactual confidence tier assignment."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.decisioning.counterfactual import (
    DriverImpactStats,
    annotate_driver_impact,
    assess_driver_confidence,
)
from app.decisioning.kpi_engine import compute_kpis
from app.pipelines.explain import compute_explanations_with_fallback
from app.pipelines.pipeline import train_model


def test_assess_high_tier_requires_low_cv_and_support_and_reliability():
    decision = assess_driver_confidence(
        DriverImpactStats(feature="x", cv_ratio=0.3, support=0.4, reliability_tier="high")
    )
    assert decision["confidence_tier"] == "high"
    assert decision["confidence_signals"]["cv_ratio"] == 0.3
    assert decision["confidence_signals"]["support"] == 0.4


def test_assess_falls_back_to_low_when_reliability_is_low():
    decision = assess_driver_confidence(
        DriverImpactStats(feature="x", cv_ratio=0.1, support=1.0, reliability_tier="low")
    )
    assert decision["confidence_tier"] == "low"


def test_assess_low_when_support_is_tiny():
    decision = assess_driver_confidence(
        DriverImpactStats(feature="x", cv_ratio=0.3, support=0.001, reliability_tier="high")
    )
    assert decision["confidence_tier"] == "low"


def test_assess_medium_when_unstable_but_supported():
    decision = assess_driver_confidence(
        DriverImpactStats(feature="x", cv_ratio=1.2, support=0.1, reliability_tier="medium")
    )
    assert decision["confidence_tier"] == "medium"


def test_annotate_driver_impact_handles_missing_shap_matrix():
    di: dict = {
        "per_driver": [
            {"feature": "a", "delta_target_rate": 0.1, "users_savable": 0, "revenue_recoverable": None},
            {"feature": "b", "delta_target_rate": 0.05, "users_savable": 0, "revenue_recoverable": None},
        ],
        "top1": {"delta_target_rate": 0.1, "users_savable": 0, "revenue_recoverable": None},
        "top2": {"delta_target_rate": 0.15, "users_savable": 0, "revenue_recoverable": None},
        "top3": {"delta_target_rate": 0.15, "users_savable": 0, "revenue_recoverable": None},
    }
    annotate_driver_impact(di, feats_topk=[], sv_matrix=None, reliability_tier="medium")
    assert all("confidence_tier" in entry for entry in di["per_driver"])
    assert di["top1"]["confidence_tier"] == "low"


def test_annotate_driver_impact_uses_shap_matrix_when_available():
    rng = np.random.default_rng(0)
    n = 400
    # `stable`: consistently moderate impact => low cv_ratio + plenty of support.
    # `noisy`: a sparse spike pattern (mostly tiny + a few huge values) so the
    # |SHAP| coefficient of variation is large enough to downgrade confidence.
    noisy_col = rng.normal(loc=0.0, scale=0.02, size=n)
    spike_idx = rng.choice(n, size=int(0.01 * n), replace=False)
    noisy_col[spike_idx] = rng.normal(loc=15.0, scale=3.0, size=spike_idx.size)
    sv = np.column_stack(
        [
            rng.normal(loc=0.6, scale=0.05, size=n),
            noisy_col,
        ]
    )
    di: dict = {
        "per_driver": [
            {"feature": "stable", "delta_target_rate": 0.2, "users_savable": 0, "revenue_recoverable": None},
            {"feature": "noisy", "delta_target_rate": 0.1, "users_savable": 0, "revenue_recoverable": None},
        ],
        "top1": {"delta_target_rate": 0.2, "users_savable": 0, "revenue_recoverable": None},
        "top2": {"delta_target_rate": 0.3, "users_savable": 0, "revenue_recoverable": None},
        "top3": {"delta_target_rate": 0.3, "users_savable": 0, "revenue_recoverable": None},
    }
    annotate_driver_impact(
        di,
        feats_topk=[("stable", 0), ("noisy", 1)],
        sv_matrix=sv,
        reliability_tier="high",
    )
    stable_tier = next(e["confidence_tier"] for e in di["per_driver"] if e["feature"] == "stable")
    noisy_tier = next(e["confidence_tier"] for e in di["per_driver"] if e["feature"] == "noisy")
    assert stable_tier == "high"
    assert noisy_tier in {"low", "medium"}
    assert di["top1"]["confidence_tier"] == stable_tier
    assert di["top2"]["confidence_tier"] in {stable_tier, noisy_tier}


def test_compute_kpis_attaches_confidence_tier_end_to_end(tmp_path):
    rng = np.random.default_rng(0)
    n = 400
    a = rng.normal(size=n)
    b = rng.normal(size=n)
    p = 1.0 / (1.0 + np.exp(-(1.6 * a + 0.5 * b)))
    y = (rng.uniform(size=n) < p).astype(int)
    df = pd.DataFrame({"a": a, "b": b, "y": y})

    result = train_model(df, "y", max_rows=2000)
    rows, _, _ = compute_explanations_with_fallback(
        result.model,
        result.X_test,
        result.feature_names,
        tmp_path,
        model_kind=result.model_kind,
        task_type=result.task_type,
        y_test=result.y_test,
        X_test_raw=result.X_test_df,
    )
    kpis = compute_kpis(
        df,
        "y",
        result.task_type,
        result.model,
        result.label_encoder,
        rows,
        result.metrics,
        result.cv_metrics,
        None,
        tmp_path,
    )
    pds = kpis["driver_impact"]["per_driver"]
    assert pds, kpis
    for entry in pds:
        assert entry["confidence_tier"] in {"high", "medium", "low"}
        signals = entry["confidence_signals"]
        assert signals["reliability_tier"] in {"high", "medium", "low"}
        assert "support" in signals
    for k_label in ("top1", "top2", "top3"):
        assert kpis["driver_impact"][k_label]["confidence_tier"] in {"high", "medium", "low"}
