"""Tests for business KPI computation."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.ml.kpis import compute_kpis
from app.ml.pipeline import RANDOM_STATE, train_model, training_work_frame


@pytest.fixture
def tmp_artifact(tmp_path: Path) -> Path:
    return tmp_path


def _work_like_train(df: pd.DataFrame, target: str, max_rows: int | None = None) -> pd.DataFrame:
    w, _, _ = training_work_frame(df, target, max_rows, RANDOM_STATE)
    return w


def test_kpis_classification_rates_and_segments(tmp_artifact: Path) -> None:
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
        tmp_artifact,
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


def test_concentrated_loss_headline(tmp_artifact: Path) -> None:
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
        tmp_artifact,
    )

    headline = kpis["concentration"]["headline"]
    assert headline["share_of_risk"] >= 0.5


def test_regression_impact_optional_value(tmp_artifact: Path) -> None:
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
        tmp_artifact,
    )

    ir = kpis["impact_revenue"]
    assert ir is not None
    assert ir["total_value"] >= ir["potential_revenue_saved"] >= 0.0


def test_missing_value_column_skips_impact_but_has_segments(tmp_artifact: Path) -> None:
    rng = np.random.default_rng(88)
    n = 200
    x = rng.normal(size=n)
    y = np.where(x > 0.1, "P", "N")
    df = pd.DataFrame({"a": x, "y": y})

    res = train_model(df, "y", test_size=0.25, random_state=42)
    work = _work_like_train(df, "y")
    shap_rows = [{"feature": "a", "mean_abs_shap": 0.9, "mean_signed_shap": 0.9, "direction": "increases"}]

    kpis = compute_kpis(work, "y", res.task_type, res.model, res.label_encoder, shap_rows, res.metrics, res.cv_metrics, None, tmp_artifact)

    assert kpis["impact_revenue"] is None
    assert kpis["risk_segments"]
