"""End-to-end smoke test: KpiEngine produces the expected JSON contract."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.decisioning.kpi_engine import KpiEngine, compute_kpis
from app.pipelines.explain import compute_explanations_with_fallback
from app.pipelines.pipeline import RANDOM_STATE, train_model, training_work_frame


def _build_binary_dataset(n: int = 400) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    a = rng.normal(size=n)
    b = rng.normal(size=n)
    p = 1.0 / (1.0 + np.exp(-(1.5 * a + 0.5 * b)))
    y = (rng.uniform(size=n) < p).astype(int)
    return pd.DataFrame({"a": a, "b": b, "y": y})


def _work_like_train(df: pd.DataFrame, target: str, max_rows: int | None = None) -> pd.DataFrame:
    w, _, _ = training_work_frame(df, target, max_rows, RANDOM_STATE)
    return w


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


def test_kpis_classification_rates_and_segments(tmp_path) -> None:
    rng = np.random.default_rng(2024)
    n = 320
    x1 = rng.normal(size=n)
    x2 = rng.normal(size=n)
    logits = 2.0 * x1 + 0.1 * x2
    p = 1.0 / (1.0 + np.exp(-np.clip(logits, -8, 8)))
    y = np.where(rng.random(n) < p, "1", "0")
    df = pd.DataFrame({"feat": x1, "feat2": x2, "y": y.astype(str), "val": np.abs(x1) * 10.0})

    res = train_model(df, "y", test_size=0.25, max_rows=None, random_state=42)
    work = _work_like_train(df, "y")
    shap_rows = [
        {"feature": "feat", "mean_abs_shap": 0.5, "mean_signed_shap": 0.4, "direction": "increases"},
        {"feature": "feat2", "mean_abs_shap": 0.1, "mean_signed_shap": 0.0, "direction": "increases"},
    ]

    kpis = compute_kpis(
        work,
        "y",
        res.task_type,
        res.model,
        res.label_encoder,
        shap_rows,
        res.metrics,
        res.cv_metrics,
        "val",
        tmp_path,
        random_state=42,
    )

    assert "target_rate" in kpis["target_level"]
    assert 0.0 <= kpis["target_level"]["target_rate"] <= 1.0
    rs = kpis["risk_segments"]
    assert len(rs) == 3
    assert sum(seg["count"] for seg in rs) == kpis["target_level"]["n_users"]
    assert kpis["concentration"]["gini"] >= 0.0
    assert "headline" in kpis["concentration"]
    assert kpis["driver_impact"]["approximation"] in ("shap_zeroing", "linear_share")


def test_concentrated_loss_headline(tmp_path) -> None:
    rng = np.random.default_rng(1)
    n = 200
    # A few rows hold most weight
    vals = rng.random(n) * 100.0
    vals[np.argsort(vals)[-20:]] += 1e6
    x1 = rng.normal(size=n)
    logits = 3.0 * x1
    y = np.where(logits > 0, "1", "0")
    df = pd.DataFrame({"f": x1, "target": y.astype(str), "money": vals})

    res = train_model(df, "target", test_size=0.2, max_rows=None, random_state=42)
    work = _work_like_train(df, "target")

    sr = [{"feature": "f", "mean_abs_shap": 1.0, "mean_signed_shap": 0.9, "direction": "increases"}]

    kpis = compute_kpis(
        work,
        "target",
        res.task_type,
        res.model,
        res.label_encoder,
        sr,
        res.metrics,
        res.cv_metrics,
        "money",
        tmp_path,
    )

    headline = kpis["concentration"]["headline"]
    assert headline["share_of_risk"] >= 0.5


def test_regression_impact_optional_value(tmp_path) -> None:
    rng = np.random.default_rng(7)
    n = 260
    x = rng.normal(size=n)
    noise = rng.normal(scale=1.5, size=n)
    tgt = x * 2.5 + noise
    df = pd.DataFrame({"x_col": x, "revenue": np.abs(rng.normal(size=n)) * 80.0, "y_reg": tgt})

    res = train_model(df, "y_reg", test_size=0.2, random_state=42)
    work = _work_like_train(df, "y_reg")
    shap_rows = [{"feature": "x_col", "mean_abs_shap": 0.6, "mean_signed_shap": 0.5, "direction": "increases"}]

    kpis = compute_kpis(
        work,
        "y_reg",
        res.task_type,
        res.model,
        res.label_encoder,
        shap_rows,
        res.metrics,
        res.cv_metrics,
        "revenue",
        tmp_path,
    )

    ir = kpis["impact_revenue"]
    assert ir is not None
    assert ir["total_value"] >= ir["potential_revenue_saved"] >= 0.0


def test_missing_value_column_skips_impact_but_has_segments(tmp_path) -> None:
    rng = np.random.default_rng(88)
    n = 200
    x = rng.normal(size=n)
    y = np.where(x > 0.1, "P", "N")
    df = pd.DataFrame({"a": x, "y": y})

    res = train_model(df, "y", test_size=0.25, random_state=42)
    work = _work_like_train(df, "y")
    shap_rows = [{"feature": "a", "mean_abs_shap": 0.9, "mean_signed_shap": 0.9, "direction": "increases"}]

    kpis = compute_kpis(work, "y", res.task_type, res.model, res.label_encoder, shap_rows, res.metrics, res.cv_metrics, None, tmp_path)

    assert kpis["impact_revenue"] is None
    assert kpis["risk_segments"]
