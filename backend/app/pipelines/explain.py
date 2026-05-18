"""SHAP / permutation explanations for tree and linear models."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import ElasticNet, LogisticRegression
from sklearn.pipeline import Pipeline as SkPipeline
from xgboost import XGBClassifier, XGBRegressor

from app.pipelines.common import TaskType, positive_class_index_for_model

# Adaptive SHAP sampling. We keep the legacy `MAX_SHAP_SAMPLES` constant for
# back-compat with `app.ml.kpis`, but explanation code routes through
# `shap_compute_sample_size` / `shap_plot_sample_size` so compute uses a larger,
# size-aware sample and the summary plot stays inside its readable budget.
MAX_SHAP_SAMPLES = 1000
SHAP_PLOT_SAMPLE_CAP = 1000
SHAP_COMPUTE_SAMPLE_CAP = 5000
SHAP_COMPUTE_MIN_SAMPLE = 500


def shap_compute_sample_size(n_rows: int) -> int:
    """Larger, dataset-aware sample for SHAP value computation.

    Returns a value in ``[SHAP_COMPUTE_MIN_SAMPLE, SHAP_COMPUTE_SAMPLE_CAP]``,
    bounded by the available row count.
    """
    if n_rows <= 0:
        return 0
    target = max(SHAP_COMPUTE_MIN_SAMPLE, n_rows // 4)
    return int(min(SHAP_COMPUTE_SAMPLE_CAP, max(1, min(target, n_rows))))


def shap_plot_sample_size(n_rows: int) -> int:
    """Cap the plot sample at ``SHAP_PLOT_SAMPLE_CAP`` rows for readable summaries."""
    if n_rows <= 0:
        return 0
    return int(min(SHAP_PLOT_SAMPLE_CAP, n_rows))


def _fallback_rows_from_importances(
    fitted_pipeline: SkPipeline | Any,
    feature_names: list[str],
) -> list[dict[str, Any]]:
    """Uniform or model-based importance when SHAP is unavailable."""
    model = (
        fitted_pipeline.named_steps["model"]
        if isinstance(fitted_pipeline, SkPipeline)
        else fitted_pipeline
    )
    n = len(feature_names)
    imp = getattr(model, "feature_importances_", None)
    if imp is not None:
        imp = np.asarray(imp, dtype=float).ravel()
        if imp.size != n:
            imp = np.ones(n) / max(n, 1)
    else:
        coef = getattr(model, "coef_", None)
        if coef is not None:
            c = np.asarray(coef, dtype=float)
            if c.ndim > 1:
                imp = np.mean(np.abs(c), axis=0).ravel()
            else:
                imp = np.abs(c).ravel()
            if imp.size != n:
                imp = np.ones(n) / max(n, 1)
        else:
            imp = np.ones(n) / max(n, 1)
    total = imp.sum() + 1e-12
    rows: list[dict[str, Any]] = []
    for i, name in enumerate(feature_names):
        w = float(imp[i]) if i < len(imp) else 0.0
        rows.append(
            {
                "feature": name,
                "mean_abs_shap": w / total,
                "mean_signed_shap": 0.0,
                "direction": "increases",
                "xgb_importance": w / total,
            }
        )
    rows.sort(key=lambda r: r["mean_abs_shap"], reverse=True)
    return rows


def compute_explanations_with_fallback(
    fitted_pipeline: SkPipeline | Any,
    X_test: np.ndarray,
    feature_names: list[str],
    artifact_dir: Path,
    model_kind: str,
    task_type: TaskType,
    y_test: np.ndarray | None = None,
    X_test_raw: pd.DataFrame | None = None,
    label_encoder: Any | None = None,
) -> tuple[list[dict[str, Any]], str | None, list[str]]:
    """
    Like compute_explanations, but never raises: falls back to model importances and optional empty plot.
    """
    import logging

    from app.decisioning import messages as user_msg

    logger = logging.getLogger(__name__)
    notes: list[str] = []
    try:
        rows, plot_err = compute_explanations(
            fitted_pipeline,
            X_test,
            feature_names,
            artifact_dir,
            model_kind,
            task_type,
            y_test=y_test,
            X_test_raw=X_test_raw,
            label_encoder=label_encoder,
        )
        if plot_err:
            notes.append(user_msg.GOODWILL_PLOT_SKIPPED)
        return rows, plot_err, notes
    except Exception as e:
        logger.warning("Explanation pipeline failed, using importance fallback: %s", e, exc_info=True)
        notes.append(user_msg.GOODWILL_EXPLANATION_FALLBACK)
        try:
            rows = _fallback_rows_from_importances(fitted_pipeline, feature_names)
        except Exception as e2:
            logger.warning("Importance fallback failed: %s", e2, exc_info=True)
            n = len(feature_names)
            rows = [
                {
                    "feature": feature_names[i],
                    "mean_abs_shap": 1.0 / max(n, 1),
                    "mean_signed_shap": 0.0,
                    "direction": "increases",
                    "xgb_importance": 1.0 / max(n, 1),
                }
                for i in range(n)
            ]
        try:
            artifact_dir.mkdir(parents=True, exist_ok=True)
            _render_bar_summary_png(rows, artifact_dir / "shap_summary.png")
        except Exception as e3:
            logger.warning("Fallback summary plot failed: %s", e3, exc_info=True)
        return rows, None, notes


def _scalar_feature_val(x: np.ndarray, i: int) -> float:
    """Index into per-feature arrays; SHAP can be 1D per feature or nested (e.g. multiclass)."""
    v = np.asarray(x[i], dtype=float).ravel()
    return float(np.mean(v)) if v.size else 0.0


def _squeeze_to_n_features(
    arr: np.ndarray,
    n_features: int,
    *,
    use_abs: bool,
) -> np.ndarray:
    """Reduce SHAP / importance arrays to shape (n_features,) for stable downstream use."""
    a = np.asarray(arr, dtype=float)
    if a.ndim == 1:
        if a.size == n_features:
            return a
        return np.resize(a, n_features)
    if a.ndim == 2:
        if a.shape[0] == n_features:
            return np.mean(np.abs(a) if use_abs else a, axis=1)
        if a.shape[1] == n_features:
            return np.mean(np.abs(a) if use_abs else a, axis=0)
    if a.ndim == 3:
        # Common: (n_samples, n_features, n_classes)
        if a.shape[1] == n_features:
            b = np.abs(a) if use_abs else a
            return np.mean(b, axis=(0, 2))
        if a.shape[2] == n_features:
            b = np.abs(a) if use_abs else a
            return np.mean(b, axis=(0, 1))
    # Fallback: average all but last dimension if it matches n_features
    if a.shape[-1] == n_features:
        b = np.abs(a) if use_abs else a
        return np.mean(b, axis=tuple(range(a.ndim - 1)))
    return np.resize(a.ravel(), n_features)


def _tree_explainer_shap(
    model: Any,
    X_sample: np.ndarray,
    task_type: TaskType,
    label_encoder: Any | None,
) -> tuple[np.ndarray, np.ndarray]:
    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(X_sample)
    pci = positive_class_index_for_model(task_type, label_encoder)
    if isinstance(sv, list):
        idx = int(min(max(pci, 0), len(sv) - 1))
        sel = np.asarray(sv[idx], dtype=float)
        mean_abs = np.abs(sel).mean(axis=0)
        mean_signed = sel.mean(axis=0)
    else:
        sv_arr = np.asarray(sv)
        n_f = X_sample.shape[1]
        if sv_arr.ndim == 3:
            if sv_arr.shape[1] == n_f:
                # (samples, features, classes)
                c_axis = 2
                n_cls = sv_arr.shape[c_axis]
                c_i = int(min(max(pci, 0), n_cls - 1))
                slab = sv_arr[:, :, c_i]
                mean_abs = np.abs(slab).mean(axis=0)
                mean_signed = slab.mean(axis=0)
            elif sv_arr.shape[2] == n_f:
                # (samples, classes, features)
                n_cls = sv_arr.shape[1]
                c_i = int(min(max(pci, 0), n_cls - 1))
                slab = sv_arr[:, c_i, :]
                mean_abs = np.abs(slab).mean(axis=0)
                mean_signed = slab.mean(axis=0)
            else:
                flat_abs = np.abs(sv_arr).mean(axis=0).ravel()
                flat_s = sv_arr.mean(axis=0).ravel()
                mean_abs = np.resize(flat_abs, n_f)
                mean_signed = np.resize(flat_s, n_f)
        else:
            mean_abs = np.abs(sv_arr).mean(axis=0)
            mean_signed = sv_arr.mean(axis=0)
    return mean_abs, mean_signed


def _linear_coef_importance(
    model: LogisticRegression | ElasticNet,
    feature_names: list[str],
    task: TaskType,
) -> tuple[np.ndarray, np.ndarray]:
    if isinstance(model, LogisticRegression):
        coef = model.coef_
        if coef.ndim > 1:
            mean_abs = np.mean(np.abs(coef), axis=0)
            mean_signed = np.mean(coef, axis=0)
        else:
            mean_abs = np.abs(coef)
            mean_signed = coef
    else:
        coef = model.coef_
        mean_abs = np.abs(coef)
        mean_signed = coef
    return mean_abs, mean_signed


def compute_explanations(
    fitted_pipeline: SkPipeline | Any,
    X_test: np.ndarray,
    feature_names: list[str],
    artifact_dir: Path,
    model_kind: str,
    task_type: TaskType,
    y_test: np.ndarray | None = None,
    X_test_raw: pd.DataFrame | None = None,
    label_encoder: Any | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Build per-feature explanation rows. Uses SHAP for tree models; coef / permutation for linear.
    `fitted_pipeline` is the full sklearn Pipeline (prep + model) when using sklearn stack.
    """
    artifact_dir.mkdir(parents=True, exist_ok=True)
    n_total = int(X_test.shape[0])
    n = shap_compute_sample_size(n_total)
    rng = np.random.default_rng(42)
    idx = rng.choice(n_total, size=n, replace=False) if n > 0 else np.empty(0, dtype=int)
    X_s = X_test[idx] if n > 0 else X_test[:0]

    model = (
        fitted_pipeline.named_steps["model"]
        if isinstance(fitted_pipeline, SkPipeline)
        else fitted_pipeline
    )

    mean_abs: np.ndarray
    mean_signed: np.ndarray
    imp: np.ndarray | None = getattr(model, "feature_importances_", None)

    if isinstance(model, (XGBClassifier, XGBRegressor, RandomForestClassifier, RandomForestRegressor)):
        mean_abs, mean_signed = _tree_explainer_shap(model, X_s, task_type, label_encoder)
        if imp is None or len(imp) != len(feature_names):
            imp = np.ones(len(feature_names)) / max(len(feature_names), 1)
    elif isinstance(model, (LogisticRegression, ElasticNet)):
        mean_abs, mean_signed = _linear_coef_importance(model, feature_names, task_type)
        if mean_abs.shape[0] != len(feature_names):
            mean_abs = np.resize(mean_abs, len(feature_names))
            mean_signed = np.resize(mean_signed, len(feature_names))
        imp = mean_abs / (mean_abs.sum() + 1e-12)
        if y_test is not None and isinstance(fitted_pipeline, SkPipeline) and X_test_raw is not None:
            try:
                X_perm = X_test_raw.iloc[idx].reset_index(drop=True)
                y_s = y_test[idx]
                perm = permutation_importance(
                    fitted_pipeline,
                    X_perm,
                    y_s,
                    n_repeats=5,
                    random_state=42,
                    n_jobs=-1,
                )
                mean_abs = perm.importances_mean
                mean_signed = np.sign(mean_abs) * np.abs(mean_abs)
            except Exception:
                pass
    else:
        mean_abs = np.ones(len(feature_names)) / max(len(feature_names), 1)
        mean_signed = mean_abs
        imp = mean_abs

    n_feat = len(feature_names)
    mean_abs = _squeeze_to_n_features(mean_abs, n_feat, use_abs=True)
    mean_signed = _squeeze_to_n_features(mean_signed, n_feat, use_abs=False)

    rows: list[dict[str, Any]] = []
    for i, name in enumerate(feature_names):
        ms = _scalar_feature_val(mean_signed, i)
        ma = _scalar_feature_val(mean_abs, i)
        direction = "increases" if ms >= 0 else "decreases"
        if imp is not None:
            imp_a = np.asarray(imp, dtype=float).ravel()
            imp_val = float(imp_a[i]) if i < imp_a.size else ma
        else:
            imp_val = ma
        rows.append(
            {
                "feature": name,
                "mean_abs_shap": ma,
                "mean_signed_shap": ms,
                "direction": direction,
                "xgb_importance": imp_val,
            }
        )
    rows.sort(key=lambda r: r["mean_abs_shap"], reverse=True)

    png_path = artifact_dir / "shap_summary.png"
    plot_err: str | None = None
    try:
        _render_shap_summary_png(
            model=model,
            X_s=X_s,
            feature_names=feature_names,
            rows=rows,
            png_path=png_path,
            task_type=task_type,
            label_encoder=label_encoder,
        )
    except Exception as e:
        plot_err = str(e)
        plt.close()
        # Fallback bar chart so a `completed` analysis always has an artifact.
        try:
            _render_bar_summary_png(rows, png_path)
            plot_err = None
        except Exception as e2:
            plot_err = f"{e}; fallback: {e2}"
            plt.close()

    return rows, plot_err


def _render_bar_summary_png(rows: list[dict[str, Any]], png_path: Path) -> None:
    """Single source of truth for the bar-style SHAP fallback chart."""
    top = sorted(rows, key=lambda r: -r["mean_abs_shap"])[:15]
    if not top:
        top = [{"feature": "(no features)", "mean_abs_shap": 0.0}]
    names = [str(r["feature"])[:40] for r in top]
    vals = [float(r["mean_abs_shap"]) for r in top]
    plt.figure(figsize=(8, max(4, len(top) * 0.25)))
    plt.barh(names[::-1], vals[::-1], color="#059669")
    plt.xlabel("Mean |SHAP| (aggregated across classes when multiclass)")
    plt.tight_layout()
    plt.savefig(png_path, dpi=120, bbox_inches="tight")
    plt.close()


def _render_shap_summary_png(
    *,
    model: Any,
    X_s: np.ndarray,
    feature_names: list[str],
    rows: list[dict[str, Any]],
    png_path: Path,
    task_type: TaskType,
    label_encoder: Any | None,
) -> None:
    """Render the per-feature SHAP summary, multiclass-safe.

    For tree models, we attempt the standard `shap.summary_plot`. Multiclass SHAP
    returns either a list (one matrix per class) or a 3D ndarray, which
    `summary_plot` does not aggregate; we fall back to a bar plot of mean |SHAP|
    averaged across classes so the artifact always exists and stays informative.
    """
    is_tree = isinstance(
        model, (XGBClassifier, XGBRegressor, RandomForestClassifier, RandomForestRegressor)
    )
    n_plot = shap_plot_sample_size(int(X_s.shape[0]))
    if n_plot <= 0:
        _render_bar_summary_png(rows, png_path)
        return

    if not is_tree:
        _render_bar_summary_png(rows, png_path)
        return

    rng = np.random.default_rng(42)
    plot_idx = rng.choice(X_s.shape[0], size=n_plot, replace=False)
    X_plot = X_s[plot_idx]

    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(X_plot)

    sv_for_plot, multiclass = _aggregate_shap_for_plot(
        sv,
        n_features=len(feature_names),
        task_type=task_type,
        label_encoder=label_encoder,
    )

    if multiclass:
        # Use the aggregated mean |SHAP| as a 1D bar summary; values are stable
        # and immediately interpretable across classes.
        mean_abs = sv_for_plot
        order = np.argsort(mean_abs)[::-1][: min(20, len(feature_names))]
        names = [feature_names[i][:40] for i in order]
        vals = [float(mean_abs[i]) for i in order]
        plt.figure(figsize=(8, max(4, len(order) * 0.3)))
        plt.barh(names[::-1], vals[::-1], color="#0ea5e9")
        plt.xlabel("Mean |SHAP| aggregated across classes")
        plt.tight_layout()
        plt.savefig(png_path, dpi=120, bbox_inches="tight")
        plt.close()
        return

    shap.summary_plot(
        sv_for_plot,
        X_plot,
        feature_names=feature_names,
        show=False,
        max_display=min(20, len(feature_names)),
    )
    plt.tight_layout()
    plt.savefig(png_path, dpi=120, bbox_inches="tight")
    plt.close()

    beeswarm_path = png_path.parent / "shap_beeswarm.png"
    try:
        shap.summary_plot(
            sv_for_plot,
            X_plot,
            feature_names=feature_names,
            show=False,
            max_display=min(12, len(feature_names)),
            plot_type="dot",
        )
        plt.tight_layout()
        plt.savefig(beeswarm_path, dpi=120, bbox_inches="tight")
        plt.close()
    except Exception:
        plt.close()


def _aggregate_shap_for_plot(
    sv: Any,
    *,
    n_features: int,
    task_type: TaskType,
    label_encoder: Any | None,
) -> tuple[np.ndarray, bool]:
    """Return (array_for_plot, is_multiclass).

    - Binary / regression: (n_samples, n_features) signed SHAP, ``is_multiclass=False``.
    - Multiclass: mean |SHAP| of shape (n_features,), ``is_multiclass=True``.
    """
    if isinstance(sv, list):
        if task_type == "classification" and len(sv) >= 2:
            pci = int(min(max(positive_class_index_for_model(task_type, label_encoder), 0), len(sv) - 1))
            arr = np.asarray(sv[pci], dtype=float)
            if arr.ndim == 2 and arr.shape[1] == n_features:
                return arr, False
            if arr.ndim == 2 and arr.shape[0] == n_features:
                return arr.T, False
        abs_stack = np.stack([np.abs(np.asarray(s, dtype=float)) for s in sv], axis=0)
        mean_abs = abs_stack.mean(axis=(0, 1))
        if mean_abs.shape[0] != n_features:
            mean_abs = np.resize(mean_abs, n_features)
        return mean_abs, True

    arr = np.asarray(sv, dtype=float)
    if arr.ndim == 3:
        pci = positive_class_index_for_model(task_type, label_encoder)
        if arr.shape[1] == n_features:
            n_cls = arr.shape[2]
            c_i = int(min(max(pci, 0), n_cls - 1))
            sel = arr[:, :, c_i]
            if n_cls <= 2:
                return sel, False
            mean_abs = np.abs(arr).mean(axis=(0, 2))
        elif arr.shape[2] == n_features:
            n_cls = arr.shape[1]
            c_i = int(min(max(pci, 0), n_cls - 1))
            sel = arr[:, c_i, :]
            if n_cls <= 2:
                return sel, False
            mean_abs = np.abs(arr).mean(axis=(0, 1))
        else:
            mean_abs = np.resize(np.abs(arr).mean(axis=0).ravel(), n_features)
            return mean_abs, True
        if mean_abs.shape[0] != n_features:
            mean_abs = np.resize(mean_abs, n_features)
        return mean_abs, True

    if arr.ndim == 2 and arr.shape[1] == n_features:
        return arr, False

    if arr.ndim == 2 and arr.shape[0] == n_features and arr.shape[1] != n_features:
        return arr.T, False

    return np.resize(arr.ravel(), n_features), True


def shap_json_dump(rows: list[dict[str, Any]]) -> str:
    return json.dumps(rows)
