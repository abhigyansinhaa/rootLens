"""Tests for training pipeline routing."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.pipeline import HIGH_CARD_MAX, train_model


def test_train_binary_classification():
    rng = np.random.default_rng(0)
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
    rng = np.random.default_rng(1)
    n = 150
    x = rng.normal(size=n)
    df = pd.DataFrame({"x": x, "y": 2.0 * x + rng.normal(scale=0.1, size=n)})
    r = train_model(df, "y", max_rows=500)
    assert r.task_type == "regression"
    assert "r2" in r.metrics
    assert r.model_kind in ("xgboost", "random_forest", "elastic_net")
    assert isinstance(r.model_metadata, dict)


def test_train_mid_cardinality_uses_target_and_freq_encoder():
    """Mid-cardinality categorical columns should add target + frequency features without OHE explosion."""
    rng = np.random.default_rng(7)
    n = 400
    n_levels = 80
    levels = [f"L{i}" for i in range(n_levels)]
    level_effect = {lvl: rng.normal() for lvl in levels}
    cats = rng.choice(levels, size=n)
    noise = rng.normal(size=n, scale=0.2)
    y = np.asarray([level_effect[c] for c in cats]) + noise
    df = pd.DataFrame({"cat_mid": cats, "y": y})

    r = train_model(df, "y", max_rows=1000)
    assert r.task_type == "regression"
    assert any(name.endswith("__te") for name in r.feature_names), r.feature_names
    assert any(name.endswith("__freq") for name in r.feature_names), r.feature_names
    assert r.metrics["r2"] > 0.3


def test_train_drops_extreme_cardinality_columns_and_warns():
    rng = np.random.default_rng(11)
    n = HIGH_CARD_MAX + 50
    df = pd.DataFrame(
        {
            "id_like": [f"u{i}_{rng.integers(0, 10_000_000)}" for i in range(n)],
            "useful_num": rng.normal(size=n),
            "target": rng.choice([0, 1], size=n),
        }
    )
    r = train_model(df, "target", max_rows=10_000)
    assert all(not str(f).startswith("id_like") for f in r.feature_names)
    assert any(
        "Dropped extremely-high-cardinality columns" in w and "id_like" in w for w in r.data_warnings
    ), r.data_warnings
    assert HIGH_CARD_MAX == 300
