from __future__ import annotations

import logging
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.calibration import calibration_curve
from sklearn.model_selection import (
    KFold,
    StratifiedKFold,
    TimeSeriesSplit,
    cross_val_score,
    train_test_split,
)

from app.pipelines.common import positive_class_index_for_model
from app.thresholds import HIGH_CARD_MAX

logger = logging.getLogger(__name__)


def prepare_training_data(
    work: pd.DataFrame, 
    target: str, 
    dc_used: str | None, 
    warnings: list[str],
    _build_column_lists: Any,
    _split_categorical_by_cardinality: Any,
) -> tuple[pd.DataFrame, list[str], list[str], list[str]]:
    drop_cols = {target}
    if dc_used and dc_used in work.columns:
        drop_cols.add(dc_used)

    X_df = work.drop(columns=list(drop_cols))
    num_cols, cat_cols = _build_column_lists(X_df)
    if not num_cols and not cat_cols:
        raise ValueError("No feature columns")

    cat_low, cat_mid, cat_dropped = _split_categorical_by_cardinality(X_df, cat_cols)
    if cat_dropped:
        warnings.append(
            "Dropped extremely-high-cardinality columns "
            f"(>{HIGH_CARD_MAX} unique levels) from training: {cat_dropped[:5]}"
            + ("..." if len(cat_dropped) > 5 else "")
            + ". These looked identifier-like; revisit with cleaner labels if you need them as drivers."
        )
        X_df = X_df.drop(columns=cat_dropped)
    return X_df, num_cols, cat_low, cat_mid


def split_training_data(
    X_df: pd.DataFrame, 
    y: np.ndarray, 
    test_size: float, 
    random_state: int, 
    use_temporal_holdout: bool, 
    task: str,
) -> tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray]:
    if use_temporal_holdout:
        n_total = len(X_df)
        split_idx = max(1, min(n_total - 1, int(np.floor(n_total * (1 - float(test_size))))))
        X_train_df = X_df.iloc[:split_idx].copy()
        X_test_df = X_df.iloc[split_idx:].copy()
        y_train = y[:split_idx]
        y_test = y[split_idx:]
    else:
        if task == "classification":
            unique, counts = np.unique(y, return_counts=True)
            stratify = y if len(unique) > 1 and counts.min() >= 2 else None
        else:
            stratify = None

        X_train_df, X_test_df, y_train, y_test = train_test_split(
            X_df,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=stratify,
        )
    return X_train_df, X_test_df, y_train, y_test


def run_cross_validation(
    full_pipe: Any, 
    X_train_df: pd.DataFrame, 
    y_train: np.ndarray, 
    task: str, 
    skip_cv: bool, 
    use_temporal_holdout: bool, 
    random_state: int,
) -> tuple[dict[str, float], str]:
    cv_metrics: dict[str, float] = {}
    validation_strategy = "holdout"
    n_splits = min(5, max(2, len(y_train) // 10))

    if skip_cv:
        validation_strategy = "holdout_cv_skipped"
    elif len(y_train) >= 30 and n_splits >= 2:
        if use_temporal_holdout:
            n_splits_ts = min(5, max(2, len(y_train) // 15))
            validation_strategy = f"walk_forward_{n_splits_ts}_fold_train"
            tscv = TimeSeriesSplit(n_splits=n_splits_ts)
            try:
                if task == "classification":
                    scores = cross_val_score(full_pipe, X_train_df, y_train, cv=tscv, scoring="accuracy", n_jobs=-1)
                    cv_metrics["cv_accuracy_mean"] = float(np.mean(scores))
                    cv_metrics["cv_accuracy_std"] = float(np.std(scores))
                else:
                    scores = cross_val_score(full_pipe, X_train_df, y_train, cv=tscv, scoring="r2", n_jobs=-1)
                    cv_metrics["cv_r2_mean"] = float(np.mean(scores))
                    cv_metrics["cv_r2_std"] = float(np.std(scores))
            except Exception:
                validation_strategy = "holdout_cv_failed"
        else:
            validation_strategy = f"{n_splits}-fold_cv_train"
            if task == "classification":
                cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
                try:
                    scores = cross_val_score(full_pipe, X_train_df, y_train, cv=cv, scoring="accuracy", n_jobs=-1)
                    cv_metrics["cv_accuracy_mean"] = float(np.mean(scores))
                    cv_metrics["cv_accuracy_std"] = float(np.std(scores))
                except Exception:
                    validation_strategy = "holdout_cv_failed"
            else:
                cv = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
                try:
                    scores = cross_val_score(full_pipe, X_train_df, y_train, cv=cv, scoring="r2", n_jobs=-1)
                    cv_metrics["cv_r2_mean"] = float(np.mean(scores))
                    cv_metrics["cv_r2_std"] = float(np.std(scores))
                except Exception:
                    validation_strategy = "holdout_cv_failed"
    return cv_metrics, validation_strategy


def evaluate_model_metrics(
    task: str, 
    y_test: np.ndarray, 
    y_pred: np.ndarray, 
    y_train: np.ndarray, 
    full_pipe: Any, 
    X_test_t: np.ndarray, 
    le: Any, 
    X_train_t: np.ndarray, 
    random_state: int, 
    cv_metrics: dict[str, float],
) -> dict[str, Any]:
    if task == "classification":
        metrics: dict[str, Any] = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "f1_macro": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        }
        n_classes_t = len(np.unique(y_train))
        if n_classes_t == 2:
            try:
                pc_idx = positive_class_index_for_model(task, le)
                proba = full_pipe.named_steps["model"].predict_proba(X_test_t)[:, pc_idx]
                metrics["roc_auc"] = float(roc_auc_score(y_test, proba))
                metrics["brier_score_loss"] = float(brier_score_loss(y_test, proba))
                prob_true, prob_pred = calibration_curve(
                    y_test, proba, n_bins=min(10, max(3, len(y_test) // 20)), strategy="uniform",
                )
                metrics["calibration_curve"] = [
                    {"mean_predicted": float(a), "fraction_positive": float(b)}
                    for a, b in zip(prob_pred, prob_true)
                ]
                try:
                    log_baseline = LogisticRegression(max_iter=400, random_state=random_state)
                    log_baseline.fit(X_train_t, y_train)
                    proba_lb = log_baseline.predict_proba(X_test_t)[:, pc_idx]
                    metrics["logistic_baseline_roc_auc"] = float(roc_auc_score(y_test, proba_lb))
                except Exception:
                    pass
            except Exception:
                metrics["roc_auc"] = 0.0
        metrics.update(cv_metrics)
    else:
        mse = mean_squared_error(y_test, y_pred)
        metrics = {
            "r2": float(r2_score(y_test, y_pred)),
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "rmse": float(np.sqrt(mse)),
        }
        metrics.update(cv_metrics)
    return metrics
