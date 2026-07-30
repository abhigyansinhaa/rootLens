from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from xgboost import XGBClassifier, XGBRegressor

from app.decisioning.kpis.driver_impact import roll_topk, sigmoid_vec
from app.decisioning.kpis.monetization import (
    classification_impact_revenue,
    regression_impact_revenue,
)
from app.pipelines.explain import MAX_SHAP_SAMPLES

logger = logging.getLogger(__name__)

def compute_classification_stats(
    model: Any,
    Xt: np.ndarray,
    df_work: pd.DataFrame,
    target: str,
    value_arr: np.ndarray,
    has_value_col: bool,
    positive_class_idx: int,
    label_encoder: Any,
    n_users: int,
) -> dict[str, Any]:
    proba_mat_full = np.asarray(model.predict_proba(Xt), dtype=float)
    n_cls = proba_mat_full.shape[1]
    if n_cls <= 2:
        risk_scores = np.clip(proba_mat_full[:, positive_class_idx].ravel(), 0.0, 1.0)
    else:
        risk_scores = np.clip(np.max(proba_mat_full[:, 1:], axis=1), 0.0, 1.0)

    ya_raw = df_work[target].to_numpy()
    if label_encoder is not None:
        ya_enc = label_encoder.transform(ya_raw.astype(str))
    else:
        ya_enc = pd.Series(ya_raw).astype(str).str.lower().isin(("1", "true", "yes")).astype(int).to_numpy()
        
    if n_cls <= 2:
        actual_bin = (ya_enc.astype(int) == positive_class_idx).astype(float)
    else:
        actual_bin = (ya_enc.astype(int) >= 1).astype(float)
        
    target_rate = float(np.mean(actual_bin))
    pred_positive = risk_scores >= 0.5
    predicted_target_rate = float(np.mean(pred_positive.astype(float)))

    concentration_loss = risk_scores * value_arr if has_value_col else risk_scores.copy()

    high_mask = risk_scores >= 0.70
    high_risk_count = int(np.sum(high_mask))
    high_risk_share = float(high_risk_count / max(n_users, 1))

    impact_rev = (
        classification_impact_revenue(
            risk_scores=risk_scores,
            value_arr=value_arr,
            high_mask=high_mask,
        )
        if has_value_col
        else None
    )

    masks = [
        risk_scores < 0.3,
        (risk_scores >= 0.3) & (risk_scores < 0.7),
        risk_scores >= 0.7,
    ]

    return {
        "proba_mat_full": proba_mat_full,
        "risk_scores": risk_scores,
        "actual_bin": actual_bin,
        "target_rate": target_rate,
        "predicted_target_rate": predicted_target_rate,
        "concentration_loss": concentration_loss,
        "high_risk_count": high_risk_count,
        "high_risk_share": high_risk_share,
        "impact_rev": impact_rev,
        "masks": masks,
        "pred_vals": None,
        "q75": 0.0,
    }

def compute_regression_stats(
    model: Any,
    Xt: np.ndarray,
    df_work: pd.DataFrame,
    target: str,
    value_arr: np.ndarray,
    has_value_col: bool,
    n_users: int,
) -> dict[str, Any]:
    pred_vals = np.asarray(model.predict(Xt), dtype=float).ravel()
    y_true = pd.to_numeric(df_work[target], errors="coerce").to_numpy()
    target_mean = float(np.nanmean(y_true))
    predicted_mean = float(np.nanmean(pred_vals))

    vmin = float(np.nanmin(pred_vals))
    vmax = float(np.nanmax(pred_vals))
    span = max(vmax - vmin, 1e-12)
    risk_scores = np.clip((pred_vals - vmin) / span, 0.0, 1.0)
    
    q75 = float(np.percentile(pred_vals, 75))
    high_mask = pred_vals >= q75
    high_risk_count = int(np.sum(high_mask))
    high_risk_share = float(high_risk_count / max(n_users, 1))

    concentration_loss = np.maximum(pred_vals, 0) * value_arr if has_value_col else np.abs(pred_vals)
    impact_rev = (
        regression_impact_revenue(
            pred_vals=pred_vals,
            value_arr=value_arr,
            high_mask=high_mask,
        )
        if has_value_col
        else None
    )

    t33 = float(np.percentile(risk_scores, 100 / 3))
    t66 = float(np.percentile(risk_scores, 200 / 3))
    masks = [risk_scores < t33, (risk_scores >= t33) & (risk_scores < t66), risk_scores >= t66]

    return {
        "proba_mat_full": None,
        "risk_scores": risk_scores,
        "actual_bin": None,
        "target_rate": target_mean,
        "predicted_target_rate": predicted_mean,
        "concentration_loss": concentration_loss,
        "high_risk_count": high_risk_count,
        "high_risk_share": high_risk_share,
        "impact_rev": impact_rev,
        "masks": masks,
        "pred_vals": pred_vals,
        "q75": q75,
    }

def bootstrap_confidence_intervals(
    rng: np.random.Generator,
    task_type: str,
    n_users: int,
    actual_bin: np.ndarray | None,
    risk_scores: np.ndarray,
    has_value_col: bool,
    value_arr: np.ndarray,
    df_work: pd.DataFrame,
    target: str,
    pred_vals: np.ndarray | None,
) -> tuple[float | None, float | None, float | None, float | None, float | None, float | None]:
    target_ci_lo = target_ci_hi = None
    hr_ci_lo = hr_ci_hi = None
    rev_ci_lo = rev_ci_hi = None

    if n_users >= 40:
        n_boot = min(400, max(120, n_users * 4))
        t_samples: list[float] = []
        hr_samples: list[float] = []
        rev_samples: list[float] = []
        for _ in range(n_boot):
            ix = rng.integers(0, n_users, size=n_users)
            if task_type == "classification" and actual_bin is not None:
                t_samples.append(float(np.mean(actual_bin[ix])))
                hr_samples.append(float(np.mean((risk_scores[ix] >= 0.70).astype(float))))
                if has_value_col:
                    rs = risk_scores[ix]
                    va = value_arr[ix]
                    rev_samples.append(float(np.sum(va[rs >= 0.5])))
            elif pred_vals is not None:
                yt_ix = pd.to_numeric(df_work[target].to_numpy(), errors="coerce")[ix]
                t_samples.append(float(np.nanmean(yt_ix)))
                pv_ix = pred_vals[ix]
                q75_ix = float(np.percentile(pv_ix, 75))
                hr_samples.append(float(np.mean((pv_ix >= q75_ix).astype(float))))
                if has_value_col:
                    pv_ix = pred_vals[ix]
                    va = value_arr[ix]
                    pm = pv_ix >= np.median(pv_ix)
                    rev_samples.append(float(np.sum(va[pm])))
                    
        ta = np.asarray(t_samples, dtype=float)
        ha = np.asarray(hr_samples, dtype=float)
        if len(ta) > 0:
            target_ci_lo, target_ci_hi = float(np.percentile(ta, 2.5)), float(np.percentile(ta, 97.5))
        if len(ha) > 0:
            hr_ci_lo, hr_ci_hi = float(np.percentile(ha, 2.5)), float(np.percentile(ha, 97.5))
        if has_value_col and rev_samples:
            ra = np.asarray(rev_samples, dtype=float)
            rev_ci_lo, rev_ci_hi = float(np.percentile(ra, 2.5)), float(np.percentile(ra, 97.5))

    return target_ci_lo, target_ci_hi, hr_ci_lo, hr_ci_hi, rev_ci_lo, rev_ci_hi

from app.pipelines.shap_cache import get_cached_shap_values, save_cached_shap_values

def compute_shap_matrix(
    model: Any,
    Xt: np.ndarray,
    task_type: str,
    positive_class_idx: int,
    rng: np.random.Generator,
    dataset_hash: str | None = None,
    schema_hash: str | None = None,
) -> tuple[np.ndarray | None, float, np.ndarray | None, str]:
    tree_ok = isinstance(
        model,
        (XGBClassifier, XGBRegressor, RandomForestClassifier, RandomForestRegressor),
    )
    approx = "shap_zeroing"
    sv_matrix_full: np.ndarray | None = None
    sv_base_val = 0.0
    samp_idx_full: np.ndarray | None = None

    if tree_ok:
        sample_n = min(Xt.shape[0], MAX_SHAP_SAMPLES)
        samp_idx_full = rng.choice(Xt.shape[0], size=sample_n, replace=False)
        X_sample = Xt[samp_idx_full]
        
        cached_sv, cached_base = get_cached_shap_values(dataset_hash, schema_hash, model, "kpi")
        if cached_sv is not None and cached_base is not None:
            return cached_sv, cached_base, samp_idx_full, approx

        try:
            explainer = shap.TreeExplainer(model)
            sv = explainer.shap_values(X_sample)
            ev_raw = explainer.expected_value
            if task_type == "regression":
                sv_arr = np.asarray(sv, dtype=float)
                if sv_arr.ndim != 2:
                    raise ValueError("bad regression shap shape")
                sv_matrix_full = sv_arr
                sv_base_val = float(ev_raw if np.isscalar(ev_raw) else float(np.asarray(ev_raw).flat[0]))
            else:
                if isinstance(sv, list):
                    sv_matrix_full = np.asarray(sv[positive_class_idx], dtype=float)
                else:
                    sv_arr = np.asarray(sv, dtype=float)
                    if sv_arr.ndim == 3:
                        sv_matrix_full = sv_arr[:, :, min(positive_class_idx, sv_arr.shape[2] - 1)]
                    else:
                        sv_matrix_full = sv_arr
                if isinstance(ev_raw, (list, np.ndarray)):
                    ev_flat = np.asarray(ev_raw).ravel()
                    sv_base_val = float(ev_flat[min(positive_class_idx, ev_flat.size - 1)])
                else:
                    sv_base_val = float(ev_raw)
            save_cached_shap_values(dataset_hash, schema_hash, model, "kpi", sv_matrix_full, sv_base_val)
        except Exception as e:
            logger.warning("SHAP matrix for KPI failed: %s", e)
            sv_matrix_full = None
            approx = "linear_share"
    else:
        approx = "linear_share"

    return sv_matrix_full, sv_base_val, samp_idx_full, approx

def compute_counterfactual_impacts(
    driver_impact: dict[str, Any],
    approx: str,
    sv_matrix_full: np.ndarray | None,
    samp_idx_full: np.ndarray | None,
    feats_topk: list[tuple[str, int]],
    task_type: str,
    sv_base_val: float,
    has_value_col: bool,
    val_samp: np.ndarray | None,
    pred_vals: np.ndarray | None,
    q75: float,
    driver_ordered: list[dict[str, Any]],
    predicted_target_rate: float,
) -> None:
    if approx == "shap_zeroing" and sv_matrix_full is not None and samp_idx_full is not None and feats_topk:
        cum_phi = sv_matrix_full
        ids = [jj for _, jj in feats_topk]

        for name, jidx in feats_topk[:5]:
            phi_k = cum_phi[:, jidx]
            if task_type == "classification":
                log_raw = sv_base_val + np.sum(cum_phi, axis=1)
                log_minus = log_raw - phi_k
                pb = sigmoid_vec(log_raw)
                pa = sigmoid_vec(log_minus)
                dtr = float(np.mean(pa - pb))
                users_savable = int(np.sum((pb >= 0.7) & (pa < 0.3)))
                rec = None
                if has_value_col and val_samp is not None:
                    vs = np.asarray(val_samp, dtype=float)
                    rec = float(np.sum(vs * (pb - pa)))
                driver_impact["per_driver"].append(
                    {"feature": name, "delta_target_rate": float(-dtr), "users_savable": users_savable, "revenue_recoverable": rec},
                )
            else:
                pred_full_line = sv_base_val + np.sum(cum_phi, axis=1)
                pred_minus_line = pred_full_line - phi_k
                pv_s = np.asarray(pred_vals, dtype=float)[samp_idx_full] if pred_vals is not None else np.zeros(len(samp_idx_full))
                dtr = float(
                    np.mean(np.abs(pv_s - pred_minus_line)) / (np.abs(np.mean(pv_s)) + 1e-9)
                )
                users_savable = int(
                    np.sum(
                        (pv_s >= q75)
                        & (pred_minus_line < float(np.percentile(pv_s, 65)))
                    )
                )
                rec = None
                if has_value_col and val_samp is not None:
                    vs = np.asarray(val_samp, dtype=float)
                    rec = float(np.sum(vs * np.abs(pv_s - pred_minus_line)))
                driver_impact["per_driver"].append(
                    {"feature": name, "delta_target_rate": float(dtr), "users_savable": users_savable, "revenue_recoverable": rec},
                )

        vals_arr = np.asarray(val_samp, dtype=float) if val_samp is not None else None
        driver_impact["top1"] = roll_topk(cum_phi, sv_base_val, ids, 1, task_type, vals_arr)
        driver_impact["top2"] = roll_topk(cum_phi, sv_base_val, ids, 2, task_type, vals_arr)
        driver_impact["top3"] = roll_topk(cum_phi, sv_base_val, ids, 3, task_type, vals_arr)

    elif driver_ordered:
        mr = predicted_target_rate + 1e-9 if task_type == "classification" else max(abs(predicted_target_rate), 1e-9)
        for r in driver_ordered[:5]:
            sh_i = float(r["mean_abs_shap"]) / (sum(float(z["mean_abs_shap"]) for z in driver_ordered[:5]) + 1e-15)
            dtr_est = float(sh_i * mr * 0.5)
            driver_impact["per_driver"].append(
                {"feature": str(r["feature"]), "delta_target_rate": dtr_est, "users_savable": 0, "revenue_recoverable": None},
            )

        pd_list = driver_impact["per_driver"]

        def _agg(ll: list[dict[str, Any]], k: int) -> dict[str, Any]:
            if not ll:
                return {"delta_target_rate": 0.0, "users_savable": 0, "revenue_recoverable": None}
            kk = min(k, len(ll))
            return {"delta_target_rate": float(sum(d["delta_target_rate"] for d in ll[:kk])), "users_savable": 0, "revenue_recoverable": None}

        driver_impact["approximation"] = "linear_share"
        driver_impact["top1"] = _agg(pd_list, 1)
        driver_impact["top2"] = _agg(pd_list, 2)
        driver_impact["top3"] = _agg(pd_list, 3)
