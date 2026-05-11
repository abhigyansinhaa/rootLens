"""End-to-end smoke test: KpiEngine produces the expected JSON contract."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.decisioning.kpi_engine import KpiEngine, compute_kpis
from app.pipelines.explain import compute_explanations_with_fallback
from app.pipelines.pipeline import train_model


def _build_binary_dataset(n: int = 400) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    a = rng.normal(size=n)
    b = rng.normal(size=n)
    p = 1.0 / (1.0 + np.exp(-(1.5 * a + 0.5 * b)))
    y = (rng.uniform(size=n) < p).astype(int)
    return pd.DataFrame({"a": a, "b": b, "y": y})


def test_kpi_engine_returns_full_contract(tmp_path):
    df = _build_binary_dataset()
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
    engine = KpiEngine()
    kpis = engine.compute(
        df_work=df,
        target="y",
        task_type=result.task_type,
        fitted_pipeline=result.model,
        label_encoder=result.label_encoder,
        shap_rows=rows,
        metrics=result.metrics,
        cv_metrics=result.cv_metrics,
        value_column=None,
        artifact_dir=tmp_path,
    )

    expected_keys = {
        "target_level",
        "impact_revenue",
        "concentration",
        "risk_segments",
        "drivers",
        "top_driver_share",
        "driver_impact",
        "reliability",
    }
    assert expected_keys.issubset(kpis), kpis.keys()
    assert kpis["impact_revenue"] is None
    assert {"score", "tier", "headline_metric", "headline_value"}.issubset(kpis["reliability"])
    assert kpis["concentration"]["headline"]["top_pct_users"] in (0.05, 0.1, 0.18, 0.2, 0.25, 0.5)
    assert len(kpis["risk_segments"]) == 3
    assert any(s.get("easiest_to_fix") for s in kpis["risk_segments"])

    # Back-compat free function should produce an identical-keys output.
    kpis2 = compute_kpis(
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
    assert set(kpis2.keys()) == set(kpis.keys())
