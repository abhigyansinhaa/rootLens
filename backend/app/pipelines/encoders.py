"""High-cardinality categorical encoders.

`OOFTargetEncoder` and `FrequencyEncoder` are sklearn-compatible transformers used
for categorical columns whose cardinality exceeds the safe one-hot ceiling but is
still inside the per-column hard cap. They are wired into the preprocessor in
`app.ml.pipeline._make_preprocessor` alongside the existing OHE path.

Design notes
------------
* Both encoders implement `BaseEstimator + TransformerMixin` and the modern
  `get_feature_names_out` contract so they slot into `ColumnTransformer` and the
  pipeline's downstream `get_feature_names_out` aggregation.
* `OOFTargetEncoder` uses K-fold out-of-fold target means at fit time to avoid
  leakage on the training rows, and falls back to the global / per-category mean
  for unseen categories at transform time.
* For classification targets we coerce labels to numeric (LabelEncoder-friendly)
  before averaging so the encoded value tracks class prevalence rather than the
  raw label string.
* `FrequencyEncoder` is fully unsupervised and emits the per-category training
  frequency (count / n_rows). Unseen categories map to 0.0. Pairing it with the
  target encoder gives downstream models both a "rate" and a "support" signal
  for the same column without exploding feature width.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import KFold


def _as_dataframe(X: Any, columns: list[str] | None = None) -> pd.DataFrame:
    if isinstance(X, pd.DataFrame):
        return X
    arr = np.asarray(X)
    if arr.ndim == 1:
        arr = arr.reshape(-1, 1)
    if columns is None:
        columns = [f"x{i}" for i in range(arr.shape[1])]
    return pd.DataFrame(arr, columns=columns)


def _coerce_target_numeric(y: Any) -> np.ndarray:
    """Return a 1D float array suitable for averaging.

    Classification targets (strings, bools, ints) are factorized so the resulting
    "mean" tracks class prevalence; regression targets pass through as floats.
    """
    s = pd.Series(np.asarray(y).ravel())
    if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
        return s.astype(float).to_numpy()
    if pd.api.types.is_bool_dtype(s):
        return s.astype(float).to_numpy()
    codes, _ = pd.factorize(s.astype(str), sort=True)
    return codes.astype(float)


class OOFTargetEncoder(BaseEstimator, TransformerMixin):
    """Out-of-fold mean target encoder with smoothing.

    Parameters
    ----------
    n_splits : int, default 5
        K-fold splits used during fit for leakage-safe encoding on training rows.
        Effective splits are clamped to ``min(n_splits, n_rows)`` and at least 2.
    smoothing : float, default 10.0
        Bayesian smoothing weight; smaller categories shrink toward the global
        target mean. ``encoded = (n_cat * mean_cat + smoothing * global) /
        (n_cat + smoothing)``.
    random_state : int, default 42
        Seed for the KFold shuffler.
    unseen_strategy : {"global"}, default "global"
        Where unseen categories at transform time map to. Currently only the
        global training-target mean is supported.
    """

    def __init__(
        self,
        n_splits: int = 5,
        smoothing: float = 10.0,
        random_state: int = 42,
        unseen_strategy: str = "global",
    ) -> None:
        self.n_splits = n_splits
        self.smoothing = smoothing
        self.random_state = random_state
        self.unseen_strategy = unseen_strategy

    def fit(self, X: Any, y: Any = None) -> "OOFTargetEncoder":
        if y is None:
            raise ValueError("OOFTargetEncoder requires y at fit time")
        X_df = _as_dataframe(X)
        y_num = _coerce_target_numeric(y)
        if len(X_df) != len(y_num):
            raise ValueError("X and y must have the same length")

        self.feature_names_in_ = np.asarray([str(c) for c in X_df.columns])
        self.n_features_in_ = X_df.shape[1]
        self.global_mean_ = float(np.mean(y_num)) if y_num.size else 0.0
        self.mappings_: dict[str, dict[str, float]] = {}

        for col in X_df.columns:
            s = X_df[col].astype("object").where(X_df[col].notna(), other="__nan__").astype(str)
            grouped = pd.DataFrame({"_cat": s.to_numpy(), "_y": y_num}).groupby("_cat")["_y"]
            means = grouped.mean()
            counts = grouped.count()
            sm = float(self.smoothing)
            smoothed = (counts * means + sm * self.global_mean_) / (counts + sm)
            self.mappings_[str(col)] = smoothed.astype(float).to_dict()
        return self

    def fit_transform(self, X: Any, y: Any = None, **fit_params: Any) -> np.ndarray:  # noqa: ARG002
        if y is None:
            raise ValueError("OOFTargetEncoder requires y at fit_transform time")
        X_df = _as_dataframe(X)
        y_num = _coerce_target_numeric(y)
        n = len(X_df)
        if n != len(y_num):
            raise ValueError("X and y must have the same length")

        self.fit(X_df, y_num)

        out = np.full((n, X_df.shape[1]), self.global_mean_, dtype=float)
        splits = max(2, min(int(self.n_splits), n))
        if splits < 2 or n < 2:
            for j, col in enumerate(X_df.columns):
                out[:, j] = self._map_column(X_df[col], str(col))
            return out

        kf = KFold(n_splits=splits, shuffle=True, random_state=self.random_state)
        sm = float(self.smoothing)
        for tr_idx, te_idx in kf.split(np.arange(n)):
            for j, col in enumerate(X_df.columns):
                cats_tr = (
                    X_df[col]
                    .iloc[tr_idx]
                    .astype("object")
                    .where(X_df[col].iloc[tr_idx].notna(), other="__nan__")
                    .astype(str)
                )
                y_tr = y_num[tr_idx]
                grouped = pd.DataFrame({"_cat": cats_tr.to_numpy(), "_y": y_tr}).groupby("_cat")["_y"]
                means = grouped.mean()
                counts = grouped.count()
                fold_global = float(np.mean(y_tr)) if y_tr.size else self.global_mean_
                smoothed = (counts * means + sm * fold_global) / (counts + sm)
                mapping = smoothed.astype(float).to_dict()
                cats_te = (
                    X_df[col]
                    .iloc[te_idx]
                    .astype("object")
                    .where(X_df[col].iloc[te_idx].notna(), other="__nan__")
                    .astype(str)
                    .to_numpy()
                )
                out[te_idx, j] = np.asarray(
                    [mapping.get(c, fold_global) for c in cats_te],
                    dtype=float,
                )
        return out

    def transform(self, X: Any) -> np.ndarray:
        X_df = _as_dataframe(X)
        out = np.full((len(X_df), X_df.shape[1]), self.global_mean_, dtype=float)
        for j, col in enumerate(X_df.columns):
            out[:, j] = self._map_column(X_df[col], str(col))
        return out

    def _map_column(self, series: pd.Series, col_name: str) -> np.ndarray:
        mapping = self.mappings_.get(col_name, {})
        s = series.astype("object").where(series.notna(), other="__nan__").astype(str).to_numpy()
        return np.asarray([mapping.get(c, self.global_mean_) for c in s], dtype=float)

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        names = input_features if input_features is not None else getattr(self, "feature_names_in_", None)
        if names is None:
            raise ValueError("OOFTargetEncoder is not fitted and no input_features supplied")
        return np.asarray([f"{n}__te" for n in names], dtype=object)


class FrequencyEncoder(BaseEstimator, TransformerMixin):
    """Per-category training frequency (count / n_rows).

    Unseen categories at transform time map to 0.0. Pairs naturally with
    `OOFTargetEncoder` as a complementary "support" signal for the same column.
    """

    def __init__(self, normalize: bool = True) -> None:
        self.normalize = normalize

    def fit(self, X: Any, y: Any = None) -> "FrequencyEncoder":  # noqa: ARG002
        X_df = _as_dataframe(X)
        self.feature_names_in_ = np.asarray([str(c) for c in X_df.columns])
        self.n_features_in_ = X_df.shape[1]
        self.n_rows_ = max(len(X_df), 1)
        self.mappings_: dict[str, dict[str, float]] = {}
        for col in X_df.columns:
            s = X_df[col].astype("object").where(X_df[col].notna(), other="__nan__").astype(str)
            counts = s.value_counts(dropna=False)
            if self.normalize:
                vals = (counts.astype(float) / float(self.n_rows_)).to_dict()
            else:
                vals = counts.astype(float).to_dict()
            self.mappings_[str(col)] = vals
        return self

    def transform(self, X: Any) -> np.ndarray:
        X_df = _as_dataframe(X)
        out = np.zeros((len(X_df), X_df.shape[1]), dtype=float)
        for j, col in enumerate(X_df.columns):
            mapping = self.mappings_.get(str(col), {})
            s = X_df[col].astype("object").where(X_df[col].notna(), other="__nan__").astype(str).to_numpy()
            out[:, j] = np.asarray([mapping.get(c, 0.0) for c in s], dtype=float)
        return out

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        names = input_features if input_features is not None else getattr(self, "feature_names_in_", None)
        if names is None:
            raise ValueError("FrequencyEncoder is not fitted and no input_features supplied")
        return np.asarray([f"{n}__freq" for n in names], dtype=object)


HIGH_CARD_MIN = 26
HIGH_CARD_MAX = 300
