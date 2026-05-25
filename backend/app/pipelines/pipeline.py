"""Train models with sklearn Pipeline, routing, and cross-validated metrics."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNet, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    roc_auc_score,
    r2_score,
)
from sklearn.calibration import calibration_curve
from sklearn.model_selection import StratifiedKFold, KFold, TimeSeriesSplit, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline as SkPipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from app.pipelines.common import TaskType, detect_task_type, positive_class_index_for_model
from app.pipelines.encoders import HIGH_CARD_MAX, FrequencyEncoder, OOFTargetEncoder

ModelKind = Literal["xgboost", "random_forest", "logistic_regression", "elastic_net"]


@dataclass
class TrainResult:
    task_type: TaskType
    metrics: dict[str, Any]
    model: Any  # fitted sklearn Pipeline ending in an estimator with tree or linear SHAP support
    X_test: np.ndarray
    y_test: np.ndarray
    y_test_raw: np.ndarray
    feature_names: list[str]
    target_name: str
    label_encoder: LabelEncoder | None
    X_train: np.ndarray
    model_kind: ModelKind
    validation_strategy: str
    confidence: Literal["high", "medium", "low"]
    data_warnings: list[str]
    cv_metrics: dict[str, float]
    preprocessor: SkPipeline | None  # full pipeline for transform()
    X_test_df: pd.DataFrame  # raw feature matrix (no target) aligned to X_test rows
    raw_feature_columns: list[str]
    model_metadata: dict[str, Any]


def _json_safe_hyperparams(params: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in params.items():
        try:
            json.dumps(v)
            out[k] = v
        except (TypeError, ValueError):
            out[k] = str(v)
    return out


MAX_CAT_LEVELS = 25
ENCODER_VERSION = "v2"
RANDOM_STATE = 42


def training_work_frame(
    df: pd.DataFrame,
    target: str,
    max_rows: int | None = None,
    random_state: int = RANDOM_STATE,
    datetime_column: str | None = None,
    data_warnings: list[str] | None = None,
) -> tuple[pd.DataFrame, TaskType, bool]:
    """
    Same row subset as train_model: dropna(target), optional chronological sort,
    optional sample, regression numeric clean.
    Returns (work_frame, task_type, temporal_order_applied).
    """
    warns = data_warnings if data_warnings is not None else []
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found")
    work = df.dropna(subset=[target]).copy()

    temporal_ordered = False
    if datetime_column and datetime_column.strip():
        dc = datetime_column.strip()
        if dc not in work.columns:
            raise ValueError(f"Datetime column '{dc}' not found")
        ts = pd.to_datetime(work[dc], errors="coerce")
        valid_ratio = float(ts.notna().mean()) if len(work) else 0.0
        if len(work) >= 10 and valid_ratio >= 0.85:
            work = (
                work.assign(__rca_ts=ts)
                .sort_values("__rca_ts", kind="mergesort")
                .drop(columns=["__rca_ts"])
                .reset_index(drop=True)
            )
            temporal_ordered = True
        else:
            warns.append(
                "Datetime column had too many invalid values for reliable ordering; "
                "using standard randomized train/test split instead of walk-forward CV.",
            )

    if max_rows is not None and len(work) > max_rows:
        work = work.sample(n=max_rows, random_state=random_state)

    y_raw = work[target]
    task = detect_task_type(y_raw)
    if task == "regression":
        y_num = pd.to_numeric(work[target], errors="coerce")
        work = work.loc[y_num.notna()].reset_index(drop=True)

    return work, task, temporal_ordered


def _build_column_lists(X: pd.DataFrame) -> tuple[list[str], list[str]]:
    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in X.columns if c not in num_cols]
    return num_cols, cat_cols


def _split_categorical_by_cardinality(
    X: pd.DataFrame,
    cat_cols: list[str],
) -> tuple[list[str], list[str], list[str]]:
    """Bucket categorical columns into low / mid / dropped by training-set cardinality."""
    low: list[str] = []
    mid: list[str] = []
    dropped: list[str] = []
    for c in cat_cols:
        nu = int(X[c].astype("object").nunique(dropna=True))
        if nu <= MAX_CAT_LEVELS:
            low.append(c)
        elif nu <= HIGH_CARD_MAX:
            mid.append(c)
        else:
            dropped.append(c)
    return low, mid, dropped


def _make_preprocessor(
    num_cols: list[str],
    cat_cols_low: list[str],
    cat_cols_mid: list[str],
) -> ColumnTransformer:
    numeric_pipe = SkPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    low_card_pipe = SkPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                    max_categories=MAX_CAT_LEVELS,
                ),
            ),
        ]
    )
    target_enc_pipe = SkPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("target_enc", OOFTargetEncoder(n_splits=5, smoothing=10.0, random_state=RANDOM_STATE)),
        ]
    )
    freq_enc_pipe = SkPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("freq_enc", FrequencyEncoder(normalize=True)),
        ]
    )

    transformers: list[tuple[str, Any, list[str]]] = []
    if num_cols:
        transformers.append(("num", numeric_pipe, num_cols))
    if cat_cols_low:
        transformers.append(("cat_low", low_card_pipe, cat_cols_low))
    if cat_cols_mid:
        transformers.append(("cat_te", target_enc_pipe, cat_cols_mid))
        transformers.append(("cat_freq", freq_enc_pipe, cat_cols_mid))
    if not transformers:
        raise ValueError("No feature columns after preprocessing")
    return ColumnTransformer(transformers=transformers, remainder="drop", verbose_feature_names_out=False)


def _get_feature_names_out(pre: ColumnTransformer, raw_cols: list[str]) -> list[str]:
    try:
        names = pre.get_feature_names_out()
        return [str(x) for x in names]
    except Exception:
        # Fallback for older sklearn
        return [f"f{i}" for i in range(pre.transform(pd.DataFrame(columns=raw_cols)).shape[1])]


def _choose_model_kind(
    task: TaskType,
    n_rows: int,
    n_numeric: int,
    n_categorical: int,
) -> ModelKind:
    """Route to a model family based on dataset shape."""
    complexity = n_numeric + min(n_categorical * 3, 50)
    if n_rows < 200:
        if task == "classification":
            return "random_forest"
        return "elastic_net" if n_numeric > n_categorical else "random_forest"
    if n_rows < 2000 and complexity < 80:
        if task == "classification":
            return "xgboost"
        return "xgboost"
    if task == "classification":
        return "xgboost"
    return "xgboost"


def _build_estimator(kind: ModelKind, task: TaskType, n_classes: int) -> Any:
    common_trees = {
        "n_estimators": 120,
        "max_depth": 8,
        "random_state": RANDOM_STATE,
        "n_jobs": -1,
    }
    if kind == "xgboost":
        if task == "classification":
            return XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=RANDOM_STATE,
                n_jobs=-1,
                objective="multi:softprob" if n_classes > 2 else "binary:logistic",
                eval_metric="mlogloss" if n_classes > 2 else "logloss",
            )
        return XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            objective="reg:squarederror",
        )
    if kind == "random_forest":
        if task == "classification":
            return RandomForestClassifier(**common_trees, class_weight="balanced_subsample")
        return RandomForestRegressor(**common_trees)
    if kind == "logistic_regression":
        return LogisticRegression(
            max_iter=500,
            random_state=RANDOM_STATE,
            class_weight="balanced",
            n_jobs=-1,
        )
    return ElasticNet(random_state=RANDOM_STATE, max_iter=2000)


def _confidence_from_metrics(
    task: TaskType,
    metrics: dict[str, Any],
    n_rows: int,
) -> Literal["high", "medium", "low"]:
    if task == "classification":
        acc = metrics.get("accuracy", 0)
        f1 = metrics.get("f1_macro", 0)
        score = 0.5 * acc + 0.5 * f1
    else:
        r2 = metrics.get("r2", -1)
        score = max(0.0, min(1.0, (r2 + 0.5) / 1.5))  # rough map
    if n_rows < 50:
        return "low"
    if score >= 0.65 and n_rows >= 200:
        return "high"
    if score >= 0.45 or n_rows >= 100:
        return "medium"
    return "low"


def train_model(
    df: pd.DataFrame,
    target: str,
    test_size: float = 0.2,
    max_rows: int | None = None,
    random_state: int = RANDOM_STATE,
    data_warnings: list[str] | None = None,
    force_model_kind: ModelKind | None = None,
    skip_cv: bool = False,
    datetime_column: str | None = None,
) -> TrainResult:
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found")

    warnings = list(data_warnings or [])
    work, task, temporal_ordered = training_work_frame(
        df, target, max_rows, random_state, datetime_column, warnings
    )

    if len(work) < 10:
        raise ValueError("Not enough rows after cleaning (need at least 10)")

    dc_used = datetime_column.strip() if datetime_column and datetime_column.strip() else None

    drop_cols = {target}
    if dc_used and dc_used in work.columns:
        drop_cols.add(dc_used)

    y_raw = work[target]
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

    pre = _make_preprocessor(num_cols, cat_low, cat_mid)
    kind = force_model_kind or _choose_model_kind(task, len(work), len(num_cols), len(cat_low) + len(cat_mid))

    if task == "classification":
        le = LabelEncoder()
        y = le.fit_transform(y_raw.astype(str))
        n_classes = len(np.unique(y))
        if n_classes < 2:
            raise ValueError("Target needs at least 2 classes")
        est = _build_estimator(kind, task, n_classes)
    else:
        le = None
        y = pd.to_numeric(y_raw, errors="coerce").values.astype(float)
        n_classes = 0
        est = _build_estimator(kind, task, 2)

    full_pipe = SkPipeline([("prep", pre), ("model", est)])

    use_temporal_holdout = temporal_ordered

    if use_temporal_holdout:
        n_total = len(work)
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
                    scores = cross_val_score(
                        full_pipe,
                        X_train_df,
                        y_train,
                        cv=tscv,
                        scoring="accuracy",
                        n_jobs=-1,
                    )
                    cv_metrics["cv_accuracy_mean"] = float(np.mean(scores))
                    cv_metrics["cv_accuracy_std"] = float(np.std(scores))
                else:
                    scores = cross_val_score(
                        full_pipe,
                        X_train_df,
                        y_train,
                        cv=tscv,
                        scoring="r2",
                        n_jobs=-1,
                    )
                    cv_metrics["cv_r2_mean"] = float(np.mean(scores))
                    cv_metrics["cv_r2_std"] = float(np.std(scores))
            except Exception:
                validation_strategy = "holdout_cv_failed"
        else:
            validation_strategy = f"{n_splits}-fold_cv_train"
            if task == "classification":
                cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
                try:
                    scores = cross_val_score(
                        full_pipe,
                        X_train_df,
                        y_train,
                        cv=cv,
                        scoring="accuracy",
                        n_jobs=-1,
                    )
                    cv_metrics["cv_accuracy_mean"] = float(np.mean(scores))
                    cv_metrics["cv_accuracy_std"] = float(np.std(scores))
                except Exception:
                    validation_strategy = "holdout_cv_failed"
            else:
                cv = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
                try:
                    scores = cross_val_score(
                        full_pipe,
                        X_train_df,
                        y_train,
                        cv=cv,
                        scoring="r2",
                        n_jobs=-1,
                    )
                    cv_metrics["cv_r2_mean"] = float(np.mean(scores))
                    cv_metrics["cv_r2_std"] = float(np.std(scores))
                except Exception:
                    validation_strategy = "holdout_cv_failed"

    t_fit0 = time.perf_counter()
    full_pipe.fit(X_train_df, y_train)
    training_duration_s = time.perf_counter() - t_fit0

    X_train_t = full_pipe.named_steps["prep"].transform(X_train_df)
    X_test_t = full_pipe.named_steps["prep"].transform(X_test_df)
    feat_names = _get_feature_names_out(full_pipe.named_steps["prep"], list(X_df.columns))

    y_pred = full_pipe.named_steps["model"].predict(X_test_t)

    if task == "classification":
        metrics: dict[str, float | list[dict[str, float]]] = {
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
                    y_test,
                    proba,
                    n_bins=min(10, max(3, len(y_test) // 20)),
                    strategy="uniform",
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

    confidence = _confidence_from_metrics(task, metrics, len(work))
    if len(work) < 50:
        warnings.append(f"Training on {len(work)} rows; interpret drivers cautiously.")

    y_test_raw_vals = le.inverse_transform(y_test) if le is not None else y_test.astype(float)

    model_metadata: dict[str, Any] = {
        "model_kind": kind,
        "hyperparameters": _json_safe_hyperparams(dict(full_pipe.named_steps["model"].get_params(deep=False))),
        "feature_names_raw": list(X_df.columns),
        "training_rows": int(len(work)),
        "train_fold_rows": int(len(y_train)),
        "test_fold_rows": int(len(y_test)),
        "training_duration_s": round(float(training_duration_s), 4),
        "datetime_column": dc_used,
        "temporal_order_applied": temporal_ordered,
        "holdout_strategy": "temporal_tail" if use_temporal_holdout else "random_stratified",
    }

    return TrainResult(
        task_type=task,
        metrics=metrics,
        model=full_pipe,
        X_test=X_test_t,
        y_test=y_test,
        y_test_raw=np.asarray(y_test_raw_vals),
        feature_names=feat_names,
        target_name=target,
        label_encoder=le,
        X_train=X_train_t,
        model_kind=kind,
        validation_strategy=validation_strategy,
        confidence=confidence,
        data_warnings=warnings,
        cv_metrics=cv_metrics,
        preprocessor=full_pipe,
        X_test_df=X_test_df.reset_index(drop=True),
        raw_feature_columns=list(X_df.columns),
        model_metadata=model_metadata,
    )


def metrics_to_json(metrics: dict[str, Any]) -> str:
    return json.dumps(metrics)


def train_model_with_fallback(
    df: pd.DataFrame,
    target: str,
    test_size: float = 0.2,
    max_rows: int | None = None,
    random_state: int = RANDOM_STATE,
    data_warnings: list[str] | None = None,
    datetime_column: str | None = None,
) -> tuple[TrainResult, list[str]]:
    """
    Train with automatic fallbacks (primary → random forest → linear/elastic, then CV skip).
    Returns (result, human-readable fallback notes for the report).
    """
    import logging

    from app.decisioning import messages as user_msg

    logger = logging.getLogger(__name__)
    notes: list[str] = []
    w = list(data_warnings or [])

    try:
        return (
            train_model(
                df,
                target,
                test_size=test_size,
                max_rows=max_rows,
                random_state=random_state,
                data_warnings=w,
                datetime_column=datetime_column,
            ),
            notes,
        )
    except Exception as e:
        logger.warning("Primary training failed: %s", e, exc_info=True)
        notes.append(user_msg.GOODWILL_TRAINING_FALLBACK)

    try:
        return (
            train_model(
                df,
                target,
                test_size=test_size,
                max_rows=max_rows,
                random_state=random_state,
                data_warnings=w,
                force_model_kind="random_forest",
                datetime_column=datetime_column,
            ),
            notes,
        )
    except Exception as e:
        logger.warning("Random forest fallback failed: %s", e, exc_info=True)

    y_probe = df.dropna(subset=[target])[target]
    task = detect_task_type(y_probe)
    linear_kind: ModelKind = "logistic_regression" if task == "classification" else "elastic_net"
    try:
        return (
            train_model(
                df,
                target,
                test_size=test_size,
                max_rows=max_rows,
                random_state=random_state,
                data_warnings=w,
                force_model_kind=linear_kind,
                skip_cv=True,
                datetime_column=datetime_column,
            ),
            notes,
        )
    except Exception as e:
        logger.warning("Linear/elastic fallback failed: %s", e, exc_info=True)

    try:
        return (
            train_model(
                df,
                target,
                test_size=max(test_size, 0.25),
                max_rows=max_rows,
                random_state=random_state,
                data_warnings=w,
                force_model_kind="random_forest",
                skip_cv=True,
                datetime_column=datetime_column,
            ),
            notes + ["Used a minimal training path (hold-out only, no CV) after earlier model errors."],
        )
    except Exception as e:
        logger.exception("All training fallbacks exhausted")
        raise RuntimeError(
            "We could not train a model on this data after several attempts. "
            "Check that features are not all empty or constant, and the target has variation."
        ) from e
