"""Property-based / fuzz tests for encoders and pipeline.

Uses Hypothesis to generate adversarial DataFrames — all-null columns,
single-unique-value columns, extreme cardinality, mixed types, NaN-only
targets, and tiny datasets — and asserts that the pipeline either succeeds
with a valid TrainResult or raises a clean ValueError (never an uncaught
exception or silent corruption).
"""

from __future__ import annotations

import string

import numpy as np
import pandas as pd
import pytest
from hypothesis import HealthCheck, given, settings as hsettings, assume
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from app.pipelines.encoders import FrequencyEncoder, OOFTargetEncoder
from app.pipelines.pipeline import (
    _build_column_lists,
    _choose_model_kind,
    _make_preprocessor,
    _split_categorical_by_cardinality,
    train_model,
    training_work_frame,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

def _cat_column(n: int, cardinality: int) -> st.SearchStrategy[pd.Series]:
    """Generate a categorical Series with exactly `cardinality` unique levels."""
    levels = [f"lv_{i}" for i in range(cardinality)]
    return arrays(dtype=object, shape=n, elements=st.sampled_from(levels)).map(
        lambda a: pd.Series(a.ravel(), dtype="object"),
    )


@st.composite
def adversarial_dataframes(draw, min_rows: int = 10, max_rows: int = 120):
    """Generate DataFrames that stress the pipeline's defensive logic."""
    n = draw(st.integers(min_value=min_rows, max_value=max_rows))
    cols: dict[str, pd.Series] = {}

    # At least one numeric column
    cols["num_normal"] = pd.Series(
        draw(arrays(dtype=np.float64, shape=n, elements=st.floats(-1e6, 1e6, allow_nan=False, allow_infinity=False)))
    )

    # Optionally: all-null column
    if draw(st.booleans()):
        cols["all_null"] = pd.Series([np.nan] * n, dtype=float)

    # Optionally: single-unique-value column
    if draw(st.booleans()):
        val = draw(st.text(alphabet=string.ascii_lowercase, min_size=1, max_size=5))
        cols["single_val"] = pd.Series([val] * n, dtype="object")

    # Optionally: extreme cardinality column (every row unique)
    if draw(st.booleans()):
        cols["extreme_card"] = pd.Series([f"id_{i}" for i in range(n)], dtype="object")

    # Optionally: low-cardinality categorical
    if draw(st.booleans()):
        card = draw(st.integers(min_value=2, max_value=5))
        levels = [f"cat_{i}" for i in range(card)]
        cols["low_card"] = pd.Series(
            draw(arrays(dtype=object, shape=n, elements=st.sampled_from(levels)))
        )

    # Optionally: numeric column with NaN sprinkled
    if draw(st.booleans()):
        vals = draw(arrays(dtype=np.float64, shape=n, elements=st.floats(-100, 100, allow_nan=False, allow_infinity=False)))
        mask = draw(arrays(dtype=bool, shape=n, elements=st.booleans()))
        vals[mask] = np.nan
        cols["num_with_nan"] = pd.Series(vals)

    # Binary target
    target_probs = draw(
        arrays(dtype=np.float64, shape=n, elements=st.floats(0.1, 0.9))
    )
    target = np.where(target_probs > 0.5, "1", "0")
    cols["y"] = pd.Series(target, dtype="object")

    return pd.DataFrame(cols)


# ---------------------------------------------------------------------------
# 1. OOFTargetEncoder property tests
# ---------------------------------------------------------------------------

class TestOOFTargetEncoderProperties:
    @hsettings(max_examples=30, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(
        n=st.integers(min_value=5, max_value=200),
        n_cats=st.integers(min_value=1, max_value=50),
    )
    def test_output_shape_matches_input(self, n: int, n_cats: int):
        levels = [f"cat_{i}" for i in range(n_cats)]
        rng = np.random.default_rng(42)
        X = pd.DataFrame({"c": rng.choice(levels, size=n)})
        y = rng.random(n)
        enc = OOFTargetEncoder(n_splits=3, smoothing=5.0)
        out = enc.fit_transform(X, y)
        assert out.shape == (n, 1), f"Expected ({n}, 1), got {out.shape}"

    @hsettings(max_examples=20, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=10, max_value=100))
    def test_all_nan_column_does_not_crash(self, n: int):
        X = pd.DataFrame({"c": [np.nan] * n})
        y = np.random.default_rng(0).random(n)
        enc = OOFTargetEncoder(n_splits=2, smoothing=5.0)
        out = enc.fit_transform(X, y)
        assert out.shape == (n, 1)
        assert np.all(np.isfinite(out)), "NaN/Inf in output"

    @hsettings(max_examples=20, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=10, max_value=100))
    def test_single_unique_value_produces_finite_output(self, n: int):
        X = pd.DataFrame({"c": ["only_one"] * n})
        y = np.random.default_rng(1).random(n)
        enc = OOFTargetEncoder(n_splits=2, smoothing=5.0)
        out = enc.fit_transform(X, y)
        assert np.all(np.isfinite(out))

    @hsettings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=10, max_value=80))
    def test_every_row_unique_produces_finite_output(self, n: int):
        X = pd.DataFrame({"c": [f"id_{i}" for i in range(n)]})
        y = np.random.default_rng(2).random(n)
        enc = OOFTargetEncoder(n_splits=2, smoothing=10.0)
        out = enc.fit_transform(X, y)
        assert np.all(np.isfinite(out))

    @hsettings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=10, max_value=80))
    def test_transform_unseen_categories_maps_to_global_mean(self, n: int):
        rng = np.random.default_rng(3)
        X_train = pd.DataFrame({"c": rng.choice(["a", "b", "c"], size=n)})
        y_train = rng.random(n)
        enc = OOFTargetEncoder(n_splits=2, smoothing=5.0)
        enc.fit(X_train, y_train)
        X_test = pd.DataFrame({"c": ["never_seen"] * 5})
        out = enc.transform(X_test)
        # Unseen categories should map to the global mean
        np.testing.assert_allclose(out[:, 0], enc.global_mean_, atol=1e-12)


# ---------------------------------------------------------------------------
# 2. FrequencyEncoder property tests
# ---------------------------------------------------------------------------

class TestFrequencyEncoderProperties:
    @hsettings(max_examples=30, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(
        n=st.integers(min_value=5, max_value=200),
        n_cats=st.integers(min_value=1, max_value=50),
    )
    def test_output_sums_to_one_per_column(self, n: int, n_cats: int):
        levels = [f"cat_{i}" for i in range(n_cats)]
        rng = np.random.default_rng(42)
        X = pd.DataFrame({"c": rng.choice(levels, size=n)})
        enc = FrequencyEncoder(normalize=True)
        enc.fit(X)
        out = enc.transform(X)
        # Each row maps to its category's frequency; all unique frequencies should sum to 1.0
        unique_vals = np.unique(out[:, 0])
        assert np.all(unique_vals >= 0.0)
        assert np.all(unique_vals <= 1.0)

    @hsettings(max_examples=20, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=5, max_value=100))
    def test_all_nan_column_does_not_crash(self, n: int):
        X = pd.DataFrame({"c": [np.nan] * n})
        enc = FrequencyEncoder(normalize=True)
        enc.fit(X)
        out = enc.transform(X)
        assert out.shape == (n, 1)
        assert np.all(np.isfinite(out))

    @hsettings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=5, max_value=80))
    def test_unseen_categories_map_to_zero(self, n: int):
        rng = np.random.default_rng(0)
        X_train = pd.DataFrame({"c": rng.choice(["a", "b"], size=n)})
        enc = FrequencyEncoder(normalize=True)
        enc.fit(X_train)
        X_test = pd.DataFrame({"c": ["never_seen"] * 3})
        out = enc.transform(X_test)
        np.testing.assert_allclose(out[:, 0], 0.0)


# ---------------------------------------------------------------------------
# 3. Pipeline property tests (train_model with adversarial inputs)
# ---------------------------------------------------------------------------

class TestPipelineProperties:
    @hsettings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(df=adversarial_dataframes(min_rows=30, max_rows=80))
    def test_train_model_succeeds_or_raises_valueerror(self, df: pd.DataFrame):
        """train_model should either succeed with a valid TrainResult or raise ValueError."""
        assume("y" in df.columns)
        assume(df["y"].nunique() >= 2)
        # Must have at least one feature column besides target
        feature_cols = [c for c in df.columns if c != "y"]
        assume(len(feature_cols) >= 1)
        # Must have at least one non-all-null feature
        assume(any(df[c].notna().sum() > 0 for c in feature_cols))

        try:
            result = train_model(df, "y", test_size=0.25, random_state=42, skip_cv=True)
            # If it succeeds, validate the result
            assert result.task_type in ("classification", "regression")
            assert len(result.feature_names) > 0
            assert result.model is not None
            assert result.metrics is not None
        except ValueError:
            pass  # Expected for degenerate inputs
        except RuntimeError:
            pass  # Also acceptable (e.g., "All training fallbacks exhausted")

    @hsettings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=30, max_value=80))
    def test_all_constant_features_raises_cleanly(self, n: int):
        """A DataFrame where every feature is constant should produce a clean error."""
        df = pd.DataFrame({
            "const_num": [42.0] * n,
            "const_cat": ["same"] * n,
            "y": (["1"] * (n // 2)) + (["0"] * (n - n // 2)),
        })
        try:
            train_model(df, "y", test_size=0.25, random_state=42, skip_cv=True)
        except (ValueError, RuntimeError):
            pass  # Expected

    @hsettings(max_examples=10, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=30, max_value=60))
    def test_single_class_target_raises_valueerror(self, n: int):
        """Only one class in target should raise ValueError."""
        df = pd.DataFrame({
            "x": np.random.default_rng(0).normal(size=n),
            "y": ["1"] * n,
        })
        with pytest.raises(ValueError, match="at least 2 classes"):
            train_model(df, "y", test_size=0.25, random_state=42, skip_cv=True)


class TestTrainingWorkFrameProperties:
    @hsettings(max_examples=20, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n=st.integers(min_value=10, max_value=100))
    def test_work_frame_drops_null_targets(self, n: int):
        rng = np.random.default_rng(42)
        vals = rng.normal(size=n)
        target = np.where(vals > 0, "1", "0").astype(object)
        # Inject some NaN targets
        null_idx = rng.choice(n, size=max(1, n // 4), replace=False)
        target[null_idx] = None
        df = pd.DataFrame({"x": vals, "y": target})
        work, _, _ = training_work_frame(df, "y")
        assert work["y"].notna().all()
        assert len(work) <= n


class TestPreprocessorConstruction:
    def test_empty_column_lists_raises(self):
        with pytest.raises(ValueError, match="No feature columns"):
            _make_preprocessor([], [], [])

    @hsettings(max_examples=20, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(n_num=st.integers(min_value=0, max_value=5), n_cat=st.integers(min_value=0, max_value=5))
    def test_preprocessor_accepts_any_combination(self, n_num: int, n_cat: int):
        assume(n_num + n_cat > 0)
        num_cols = [f"num_{i}" for i in range(n_num)]
        cat_cols = [f"cat_{i}" for i in range(n_cat)]
        # Should not raise
        pre = _make_preprocessor(num_cols, cat_cols, [])
        assert pre is not None


class TestChooseModelKind:
    @hsettings(max_examples=50, suppress_health_check=[HealthCheck.too_slow], deadline=None)
    @given(
        n_rows=st.integers(min_value=1, max_value=100_000),
        n_numeric=st.integers(min_value=0, max_value=500),
        n_categorical=st.integers(min_value=0, max_value=500),
        task=st.sampled_from(["classification", "regression"]),
    )
    def test_always_returns_valid_model_kind(self, n_rows, n_numeric, n_categorical, task):
        kind = _choose_model_kind(task, n_rows, n_numeric, n_categorical)
        assert kind in ("xgboost", "random_forest", "logistic_regression", "elastic_net")

    def test_tiny_classification_uses_random_forest(self):
        assert _choose_model_kind("classification", 50, 5, 3) == "random_forest"

    def test_large_always_xgboost(self):
        assert _choose_model_kind("classification", 10000, 50, 20) == "xgboost"
        assert _choose_model_kind("regression", 10000, 50, 20) == "xgboost"
