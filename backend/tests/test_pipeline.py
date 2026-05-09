"""Tests for training pipeline routing."""

from __future__ import annotations

import pandas as pd
from app.ml.pipeline import train_model


def test_train_binary_classification():
    rng = __import__("numpy").random.default_rng(0)
    n = 200
    df = pd.DataFrame(
        {
            "feat_num": rng.normal(size=n),
            "feat_cat": rng.choice(["a", "b", "c"], size=n),
            "target": rng.choice([0, 1], size=n),
        }
    )
    r = train_model(df, "target", max_rows=500)
    assert r.task_type == "classification"
    assert "accuracy" in r.metrics
    assert r.model_kind in ("xgboost", "random_forest")
    assert len(r.feature_names) >= 1
    assert isinstance(r.model_metadata, dict)
    assert "training_rows" in r.model_metadata


def test_train_regression():
    rng = __import__("numpy").random.default_rng(1)
    n = 150
    x = rng.normal(size=n)
    df = pd.DataFrame({"x": x, "y": 2.0 * x + rng.normal(scale=0.1, size=n)})
    r = train_model(df, "y", max_rows=500)
    assert r.task_type == "regression"
    assert "r2" in r.metrics
    assert r.model_kind in ("xgboost", "random_forest", "elastic_net")
    assert isinstance(r.model_metadata, dict)
