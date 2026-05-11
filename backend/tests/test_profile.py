"""Tests for dataset profiling and target suitability."""

from __future__ import annotations

import pandas as pd
from app.ml.profile import profile_dataset_for_target


def _meta(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": c,
            "dtype": str(df[c].dtype),
            "null_ratio": float(df[c].isna().mean()),
            "n_unique": int(df[c].nunique()),
        }
        for c in df.columns
    ]


def test_missing_target_blocks():
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    pr = profile_dataset_for_target(df, "missing", _meta(df))
    assert not pr.ok
    assert any("not found" in e.lower() for e in pr.blocking_errors)


def test_id_like_classification_blocks():
    df = pd.DataFrame({"y": [f"id{i}" for i in range(100)], "x": range(100)})
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert not pr.ok


def test_binary_classification_ok():
    df = pd.DataFrame({"y": [0, 1] * 30, "x": range(60)})
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert pr.ok
    assert pr.task_type == "classification"


def test_regression_ok():
    rng = __import__("numpy").random.default_rng(42)
    y = rng.normal(size=80)
    df = pd.DataFrame({"y": y, "x": range(80)})
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert pr.ok
    assert pr.task_type == "regression"


def test_leakage_regression_warns_on_near_identical_column():
    import numpy as np

    rng = np.random.default_rng(0)
    y = rng.normal(size=200)
    leak = y + rng.normal(scale=1e-3, size=200)
    df = pd.DataFrame({"y": y, "x_noise": rng.normal(size=200), "leaky": leak})
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert pr.ok
    assert any("Potential leakage" in w and "leaky" in w for w in pr.warnings), pr.warnings


def test_leakage_classification_warns_on_target_copy():
    import numpy as np

    rng = np.random.default_rng(1)
    n = 240
    y = rng.choice([0, 1], size=n)
    df = pd.DataFrame(
        {
            "y": y,
            "leaky_copy": y.astype(float) + rng.normal(scale=1e-4, size=n),
            "noise": rng.normal(size=n),
        }
    )
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert pr.ok
    assert any("leaky_copy" in w and "leakage" in w.lower() for w in pr.warnings), pr.warnings


def test_no_leakage_for_independent_features():
    import numpy as np

    rng = np.random.default_rng(2)
    n = 200
    df = pd.DataFrame(
        {
            "y": rng.normal(size=n),
            "a": rng.normal(size=n),
            "b": rng.normal(size=n),
        }
    )
    pr = profile_dataset_for_target(df, "y", _meta(df))
    assert pr.ok
    assert not any("Potential leakage" in w for w in pr.warnings)
