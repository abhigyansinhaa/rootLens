"""Tests for the high-cardinality encoders used by `_make_preprocessor`.

Goal: prove `OOFTargetEncoder` + `FrequencyEncoder` on >25-level categoricals do
not regress AUC/R^2 vs an OHE-only baseline. The high-cardinality regime is
where naive OHE explodes the feature width and tree models under-utilise the
signal; these regression tests guard the preprocessor / encoder wiring.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import r2_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline as SkPipeline
from sklearn.preprocessing import OneHotEncoder

from app.ml.encoders import FrequencyEncoder, OOFTargetEncoder


RANDOM_STATE = 42


def _make_high_card_regression_dataset(n: int = 600, n_levels: int = 80) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_STATE)
    levels = np.asarray([f"L{i}" for i in range(n_levels)])
    level_effect = rng.normal(size=n_levels)
    cats = rng.choice(levels, size=n)
    idx = {lvl: i for i, lvl in enumerate(levels)}
    y = np.asarray([level_effect[idx[c]] for c in cats]) + rng.normal(scale=0.1, size=n)
    noise_num = rng.normal(size=n)
    return pd.DataFrame({"cat_high": cats, "num_noise": noise_num, "y": y})


def _make_high_card_classification_dataset(n: int = 600, n_levels: int = 80) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_STATE + 1)
    levels = np.asarray([f"L{i}" for i in range(n_levels)])
    level_logit = rng.normal(size=n_levels, scale=1.2)
    cats = rng.choice(levels, size=n)
    idx = {lvl: i for i, lvl in enumerate(levels)}
    logits = np.asarray([level_logit[idx[c]] for c in cats]) + rng.normal(scale=0.5, size=n)
    p = 1.0 / (1.0 + np.exp(-logits))
    y = (rng.uniform(size=n) < p).astype(int)
    return pd.DataFrame({"cat_high": cats, "num_noise": rng.normal(size=n), "y": y})


def _build_encoder_pipe_regression() -> SkPipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", ["num_noise"]),
            ("te", OOFTargetEncoder(n_splits=5, smoothing=10.0, random_state=RANDOM_STATE), ["cat_high"]),
            ("freq", FrequencyEncoder(normalize=True), ["cat_high"]),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return SkPipeline(
        steps=[
            ("prep", pre),
            ("model", RandomForestRegressor(n_estimators=120, max_depth=8, random_state=RANDOM_STATE, n_jobs=1)),
        ]
    )


def _build_ohe_pipe_regression() -> SkPipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", ["num_noise"]),
            (
                "ohe",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["cat_high"],
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return SkPipeline(
        steps=[
            ("prep", pre),
            ("model", RandomForestRegressor(n_estimators=120, max_depth=8, random_state=RANDOM_STATE, n_jobs=1)),
        ]
    )


def _build_encoder_pipe_classification() -> SkPipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", ["num_noise"]),
            ("te", OOFTargetEncoder(n_splits=5, smoothing=10.0, random_state=RANDOM_STATE), ["cat_high"]),
            ("freq", FrequencyEncoder(normalize=True), ["cat_high"]),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return SkPipeline(
        steps=[
            ("prep", pre),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=120, max_depth=8, random_state=RANDOM_STATE, n_jobs=1
                ),
            ),
        ]
    )


def _build_ohe_pipe_classification() -> SkPipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", ["num_noise"]),
            (
                "ohe",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["cat_high"],
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return SkPipeline(
        steps=[
            ("prep", pre),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=120, max_depth=8, random_state=RANDOM_STATE, n_jobs=1
                ),
            ),
        ]
    )


def test_target_encoder_handles_unseen_categories():
    df = _make_high_card_regression_dataset(n=200, n_levels=20)
    enc = OOFTargetEncoder(n_splits=5, smoothing=5.0, random_state=RANDOM_STATE)
    enc.fit(df[["cat_high"]], df["y"].to_numpy())
    new = pd.DataFrame({"cat_high": ["___never_seen___"]})
    out = enc.transform(new)
    assert out.shape == (1, 1)
    assert np.isfinite(out[0, 0])
    assert out[0, 0] == pytest.approx(enc.global_mean_, rel=0, abs=1e-9)


def test_frequency_encoder_outputs_normalized_probabilities():
    df = pd.DataFrame({"c": ["a"] * 70 + ["b"] * 20 + ["c"] * 10})
    enc = FrequencyEncoder(normalize=True).fit(df[["c"]])
    out = enc.transform(df[["c"]])
    assert out.shape == (100, 1)
    assert out[df["c"] == "a"][0, 0] == pytest.approx(0.7, abs=1e-9)
    assert out[df["c"] == "b"][0, 0] == pytest.approx(0.2, abs=1e-9)
    unseen = enc.transform(pd.DataFrame({"c": ["zzz"]}))
    assert unseen[0, 0] == 0.0


def test_target_encoder_does_not_regress_r2_vs_ohe():
    df = _make_high_card_regression_dataset(n=600, n_levels=80)
    X = df[["cat_high", "num_noise"]]
    y = df["y"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=RANDOM_STATE)

    enc_pipe = _build_encoder_pipe_regression().fit(X_tr, y_tr)
    enc_r2 = float(r2_score(y_te, enc_pipe.predict(X_te)))

    ohe_pipe = _build_ohe_pipe_regression().fit(X_tr, y_tr)
    ohe_r2 = float(r2_score(y_te, ohe_pipe.predict(X_te)))

    assert enc_r2 >= ohe_r2 - 0.05, f"TE+Freq R^2 regressed vs OHE: te={enc_r2:.3f} ohe={ohe_r2:.3f}"
    assert enc_r2 > 0.2, f"target encoder should learn category structure (got R^2={enc_r2:.3f})"


def test_target_encoder_does_not_regress_auc_vs_ohe():
    df = _make_high_card_classification_dataset(n=800, n_levels=80)
    X = df[["cat_high", "num_noise"]]
    y = df["y"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    enc_pipe = _build_encoder_pipe_classification().fit(X_tr, y_tr)
    enc_auc = float(roc_auc_score(y_te, enc_pipe.predict_proba(X_te)[:, 1]))

    ohe_pipe = _build_ohe_pipe_classification().fit(X_tr, y_tr)
    ohe_auc = float(roc_auc_score(y_te, ohe_pipe.predict_proba(X_te)[:, 1]))

    assert enc_auc >= ohe_auc - 0.03, (
        f"TE+Freq AUC regressed vs OHE: te={enc_auc:.3f} ohe={ohe_auc:.3f}"
    )
    assert enc_auc > 0.6, f"target encoder should learn category structure (got AUC={enc_auc:.3f})"


def test_encoder_feature_names_out_distinguishes_te_and_freq():
    enc_te = OOFTargetEncoder(n_splits=2).fit(
        pd.DataFrame({"cat": ["a", "b", "a"], "cat2": ["x", "y", "x"]}),
        np.asarray([0, 1, 0]),
    )
    names = list(enc_te.get_feature_names_out())
    assert names == ["cat__te", "cat2__te"]

    enc_freq = FrequencyEncoder().fit(pd.DataFrame({"c": ["a", "a", "b"]}))
    assert list(enc_freq.get_feature_names_out()) == ["c__freq"]
