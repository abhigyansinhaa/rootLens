"""Dataset profiling and target suitability checks before training."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import pandas as pd

from app.pipelines.common import TaskType, detect_task_type

logger = logging.getLogger(__name__)

# Heuristic thresholds (tunable)
MIN_ROWS_FOR_ANALYSIS = 10
MIN_ROWS_RECOMMENDED = 50
MAX_CLASSIFICATION_CARDINALITY = 50
ID_LIKE_UNIQUE_RATIO = 0.5
HIGH_NULL_RATIO = 0.5
HIGH_CARD_CAT_UNIQUE = 100
LEAKAGE_NAME_SUBSTR = ("id", "uuid", "email", "phone", "ssn", "hash")

# Leakage detection thresholds. Stay generous on purpose: we want to flag the
# tell-tale "this column is the target in disguise" pattern without spamming
# users about merely-predictive features.
LEAKAGE_CORR_ABS_THRESHOLD = 0.98
LEAKAGE_MI_SCORE_THRESHOLD = 0.95
LEAKAGE_MI_SAMPLE_ROWS = 5000


@dataclass
class ProfileResult:
    """Result of profiling a dataframe for a given target column."""

    ok: bool
    blocking_errors: list[str]
    warnings: list[str]
    dataset_health: dict[str, Any]
    target_suitability: dict[str, Any]
    task_type: TaskType | None
    n_rows_effective: int
    n_features: int

    def to_report_section(self) -> dict[str, Any]:
        return {
            "dataset_health": self.dataset_health,
            "target_suitability": self.target_suitability,
            "warnings": self.warnings,
            "blocking_errors": self.blocking_errors,
            "task_type_hint": self.task_type,
        }


def _dataset_health(df: pd.DataFrame, column_meta: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(df)
    dup_ratio = float(df.duplicated().sum() / n) if n else 0.0
    constant_cols = [c for c in df.columns if df[c].nunique(dropna=True) <= 1]
    meta_by_name = {m["name"]: m for m in column_meta}
    high_null = [c for c in df.columns if meta_by_name.get(c, {}).get("null_ratio", 0) > HIGH_NULL_RATIO]
    return {
        "n_rows": n,
        "n_columns": df.shape[1],
        "duplicate_row_ratio": round(dup_ratio, 4),
        "n_constant_columns": len(constant_cols),
        "high_null_columns_count": len(high_null),
        "constant_columns_sample": constant_cols[:10],
    }


def _target_suitability(
    df: pd.DataFrame,
    target: str,
    column_meta: list[dict[str, Any]],
) -> dict[str, Any]:
    meta_by_name = {m["name"]: m for m in column_meta}
    m = meta_by_name.get(target, {})
    y = df[target]
    n = len(df.dropna(subset=[target]))
    n_unique = int(y.nunique(dropna=True))
    null_ratio = float(m.get("null_ratio", y.isna().mean()))
    task = detect_task_type(y.loc[y.notna()] if len(y) else y)

    imbalance_ratio: float | None = None
    if task == "classification" and n_unique >= 2:
        vc = y.astype(str).value_counts()
        imbalance_ratio = float(vc.min() / max(vc.sum(), 1))

    return {
        "target": target,
        "task_hint": task,
        "n_non_null": n,
        "n_unique": n_unique,
        "null_ratio": round(null_ratio, 4),
        "class_imbalance_minority_ratio": round(imbalance_ratio, 4) if imbalance_ratio is not None else None,
    }


def profile_dataset_for_target(
    df: pd.DataFrame,
    target: str,
    column_meta: list[dict[str, Any]],
) -> ProfileResult:
    """
    Validate dataset and target before ML. Sets ok=False if training should not proceed.
    """
    blocking: list[str] = []
    warnings: list[str] = []

    if target not in df.columns:
        blocking.append(f"Target column '{target}' not found in dataset.")
        return ProfileResult(
            ok=False,
            blocking_errors=blocking,
            warnings=warnings,
            dataset_health={},
            target_suitability={},
            task_type=None,
            n_rows_effective=0,
            n_features=0,
        )

    health = _dataset_health(df, column_meta)
    suitability = _target_suitability(df, target, column_meta)

    work = df.dropna(subset=[target])
    n_eff = len(work)
    n_features = max(0, df.shape[1] - 1)

    if n_eff < MIN_ROWS_FOR_ANALYSIS:
        blocking.append(
            f"Not enough rows with non-null target: {n_eff} (need at least {MIN_ROWS_FOR_ANALYSIS})."
        )

    if health["duplicate_row_ratio"] > 0.3:
        warnings.append(
            f"High duplicate row ratio ({health['duplicate_row_ratio']:.0%}); consider deduplicating for cleaner RCA."
        )

    y = work[target]
    task = detect_task_type(y)

    if task == "classification":
        n_unique = int(y.astype(str).nunique())
        suitability["task_resolved"] = "classification"
        if n_unique > MAX_CLASSIFICATION_CARDINALITY or n_unique > ID_LIKE_UNIQUE_RATIO * max(n_eff, 1):
            blocking.append(
                f"Target '{target}' has {n_unique} unique values over {n_eff} rows. "
                "This looks like an identifier or high-cardinality field, not a classification target. "
                "Choose a column with fewer categories or a numeric metric."
            )
        elif n_unique < 2:
            blocking.append(f"Target '{target}' has fewer than 2 classes; cannot train a classifier.")

        if n_unique == 2 and suitability.get("class_imbalance_minority_ratio") is not None:
            ir = suitability["class_imbalance_minority_ratio"]
            if ir is not None and ir < 0.05:
                warnings.append(
                    f"Severe class imbalance (minority class ~{ir:.1%} of rows); metrics may be unstable."
                )
    else:
        suitability["task_resolved"] = "regression"
        y_num = pd.to_numeric(y, errors="coerce")
        valid = y_num.notna().sum()
        if valid < MIN_ROWS_FOR_ANALYSIS:
            blocking.append(f"Not enough numeric target values after coercion: {valid}.")
        var = float(y_num.var()) if valid > 1 else 0.0
        if var < 1e-12:
            warnings.append(f"Target '{target}' is nearly constant; model explanations may be uninformative.")

    if n_eff < MIN_ROWS_RECOMMENDED:
        warnings.append(
            f"Only {n_eff} rows with non-null target; results are more reliable with at least {MIN_ROWS_RECOMMENDED} rows."
        )

    # Leakage hints: ID-like feature names
    meta_map = {m["name"]: m for m in column_meta}
    for c in df.columns:
        if c == target:
            continue
        cl = c.lower()
        if any(s in cl for s in LEAKAGE_NAME_SUBSTR):
            mc = meta_map.get(c)
            if mc is not None and mc.get("n_unique", 0) > 0.9 * max(n_eff, 1):
                warnings.append(
                    f"Column '{c}' looks identifier-like (high cardinality); consider excluding from drivers."
                )

    leakage_signals = _detect_leakage_signals(work, target, task)
    for sig in leakage_signals:
        warnings.append(sig)

    ok = len(blocking) == 0
    return ProfileResult(
        ok=ok,
        blocking_errors=blocking,
        warnings=warnings,
        dataset_health=health,
        target_suitability=suitability,
        task_type=task if ok else (task if not blocking else None),
        n_rows_effective=n_eff,
        n_features=n_features,
    )


def _detect_leakage_signals(
    work: pd.DataFrame,
    target: str,
    task: TaskType,
) -> list[str]:
    """Warn (never block) when a feature looks like the target in disguise.

    Two passes:
    * numeric features vs numeric / encoded target: |Pearson correlation| above
      ``LEAKAGE_CORR_ABS_THRESHOLD``;
    * classification only: ``mutual_info_classif`` against a sample, flagging
      features whose normalized MI exceeds ``LEAKAGE_MI_SCORE_THRESHOLD``.

    Both checks run on the cleaned `work` frame (NA-dropped target) so they are
    representative of training-time conditions. Warnings only — they never block
    a run, but they are surfaced via governance signals downstream.
    """
    if target not in work.columns or len(work) < MIN_ROWS_FOR_ANALYSIS:
        return []

    signals: list[str] = []

    try:
        y_numeric = _encode_target_for_correlation(work[target], task)
    except Exception:
        y_numeric = None

    if y_numeric is not None:
        for col in work.columns:
            if col == target:
                continue
            s = work[col]
            if not pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s):
                continue
            try:
                x = pd.to_numeric(s, errors="coerce")
                paired = pd.DataFrame({"x": x, "y": y_numeric}).dropna()
                if len(paired) < MIN_ROWS_FOR_ANALYSIS:
                    continue
                if paired["x"].nunique() < 2 or paired["y"].nunique() < 2:
                    continue
                corr = float(paired["x"].corr(paired["y"]))
                if np.isfinite(corr) and abs(corr) >= LEAKAGE_CORR_ABS_THRESHOLD:
                    signals.append(
                        f"Potential leakage: '{col}' correlates with '{target}' "
                        f"at |r|={abs(corr):.3f}. Confirm this column is known at "
                        "the prediction time, not after the outcome is realized."
                    )
            except Exception as e:
                logger.debug("Correlation leakage probe failed for %s: %s", col, e)

    if task == "classification":
        signals.extend(_mutual_info_leakage_signals(work, target))

    return signals


def _encode_target_for_correlation(y: pd.Series, task: TaskType) -> pd.Series:
    """Coerce the target to a numeric series for correlation checks."""
    if pd.api.types.is_numeric_dtype(y) and not pd.api.types.is_bool_dtype(y):
        return pd.to_numeric(y, errors="coerce")
    if pd.api.types.is_bool_dtype(y):
        return y.astype(float)
    if task == "classification":
        codes, _ = pd.factorize(y.astype(str), sort=True)
        out = pd.Series(codes.astype(float), index=y.index)
        out[codes < 0] = float("nan")
        return out
    return pd.to_numeric(y, errors="coerce")


def _mutual_info_leakage_signals(work: pd.DataFrame, target: str) -> list[str]:
    """Sample-based mutual information probe for classification leakage."""
    try:
        from sklearn.feature_selection import mutual_info_classif
        from sklearn.preprocessing import LabelEncoder
    except Exception:
        return []

    sample = work
    if len(sample) > LEAKAGE_MI_SAMPLE_ROWS:
        sample = sample.sample(n=LEAKAGE_MI_SAMPLE_ROWS, random_state=42)

    y_raw = sample[target].astype(str)
    if y_raw.nunique() < 2:
        return []

    feature_cols = [c for c in sample.columns if c != target]
    if not feature_cols:
        return []

    X = sample[feature_cols].copy()
    numeric_X = pd.DataFrame(index=X.index)
    for col in feature_cols:
        s = X[col]
        if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
            numeric_X[col] = pd.to_numeric(s, errors="coerce").fillna(s.median() if s.notna().any() else 0.0)
        else:
            codes, _ = pd.factorize(s.astype(str), sort=True)
            numeric_X[col] = pd.Series(codes.astype(float), index=s.index)

    if numeric_X.shape[1] == 0:
        return []

    try:
        y_enc = LabelEncoder().fit_transform(y_raw.to_numpy())
        mi = mutual_info_classif(numeric_X.to_numpy(), y_enc, random_state=42)
    except Exception as e:
        logger.debug("mutual_info_classif leakage probe failed: %s", e)
        return []

    mi = np.asarray(mi, dtype=float)
    if mi.size == 0 or not np.any(mi > 0):
        return []

    peak = float(np.max(mi))
    if peak <= 1e-12:
        return []
    mi_norm = mi / peak
    second_peak = float(np.partition(mi, -2)[-2]) if mi.size >= 2 else 0.0
    flagged: list[str] = []
    for col, score, raw_mi in zip(numeric_X.columns, mi_norm, mi):
        if not np.isfinite(score) or not np.isfinite(raw_mi):
            continue
        # Normalizing by max(mi) always yields 1.0 for the top feature; require a
        # large gap vs the next-strongest signal so legitimate top drivers (e.g.
        # contract_type on churn) are not auto-flagged.
        if score >= LEAKAGE_MI_SCORE_THRESHOLD and raw_mi >= max(second_peak * 2.0, second_peak + 0.05):
            flagged.append(
                f"Potential leakage: '{col}' carries mutual-information signal "
                f"comparable to '{target}' itself (relative MI={score:.2f}). "
                "Verify it is not derived from the outcome."
            )
    return flagged
