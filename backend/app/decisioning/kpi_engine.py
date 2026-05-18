"""KpiEngine: thin orchestrator over per-KPI modules.

Logic is byte-identical to the original ``compute_kpis`` function in the
pre-split ``decisioning/kpis.py`` — same inputs, same JSON output. The split
gives each KPI a dedicated module so future bug fixes and driver-confidence
work have a clean place to live. No new framework, no plugin registry; direct
imports per the constrained plan.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.pipeline import Pipeline as SkPipeline
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier, XGBRegressor

from app.decisioning.counterfactual import annotate_driver_impact
from app.decisioning.kpis.concentration import concentration_headline, gini_nonnegative
from app.decisioning.kpis.concentration_narrative import concentration_interpretation, pareto_cut_table
from app.decisioning.kpis.driver_impact import feat_index, roll_topk, sigmoid_vec
from app.decisioning.kpis.intervention_confidence import build_intervention_confidence
from app.decisioning.kpis.monetization import (
    classification_impact_revenue,
    regression_impact_revenue,
)
from app.decisioning.kpis.reliability import reliability_block
from app.decisioning.kpis.segment_value import build_risk_segments
from app.pipelines.common import TaskType, positive_class_index_for_model
from app.pipelines.explain import MAX_SHAP_SAMPLES

logger = logging.getLogger(__name__)


class KpiEngine:
    """Plain-Python orchestrator that composes the per-KPI helpers.

    Construction is cheap and intentionally stateless — every analysis builds a
    fresh engine. ``compute()`` returns the same dict shape the legacy
    ``compute_kpis`` function returned, so the API contract is unchanged.
    """

    def __init__(self, *, random_state: int = 42) -> None:
        self.random_state = int(random_state)

    def compute(
        self,
        *,
        df_work: pd.DataFrame,
        target: str,
        task_type: TaskType,
        fitted_pipeline: SkPipeline | Any,
        label_encoder: LabelEncoder | None,
        shap_rows: list[dict[str, Any]],
        metrics: dict[str, float],
        cv_metrics: dict[str, float],
        value_column: str | None,
        artifact_dir: Path,
        data_warning_count: int = 0,
    ) -> dict[str, Any]:
        return _compute_kpis_impl(
            df_work,
            target,
            task_type,
            fitted_pipeline,
            label_encoder,
            shap_rows,
            metrics,
            cv_metrics,
            value_column,
            artifact_dir,
            data_warning_count=data_warning_count,
            random_state=self.random_state,
        )


def compute_kpis(
    df_work: pd.DataFrame,
    target: str,
    task_type: TaskType,
    fitted_pipeline: SkPipeline | Any,
    label_encoder: LabelEncoder | None,
    shap_rows: list[dict[str, Any]],
    metrics: dict[str, float],
    cv_metrics: dict[str, float],
    value_column: str | None,
    artifact_dir: Path,
    *,
    data_warning_count: int = 0,
    random_state: int = 42,
) -> dict[str, Any]:
    """Back-compat free-function wrapper around `KpiEngine`."""
    return KpiEngine(random_state=random_state).compute(
        df_work=df_work,
        target=target,
        task_type=task_type,
        fitted_pipeline=fitted_pipeline,
        label_encoder=label_encoder,
        shap_rows=shap_rows,
        metrics=metrics,
        cv_metrics=cv_metrics,
        value_column=value_column,
        artifact_dir=artifact_dir,
        data_warning_count=data_warning_count,
    )


def _compute_kpis_impl(
    df_work: pd.DataFrame,
    target: str,
    task_type: TaskType,
    fitted_pipeline: SkPipeline | Any,
    label_encoder: LabelEncoder | None,
    shap_rows: list[dict[str, Any]],
    metrics: dict[str, float],
    cv_metrics: dict[str, float],
    value_column: str | None,
    artifact_dir: Path,
    *,
    data_warning_count: int = 0,
    random_state: int = 42,
) -> dict[str, Any]:
    rng = np.random.default_rng(random_state)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    prep = fitted_pipeline.named_steps["prep"]
    model = fitted_pipeline.named_steps["model"]

    X_df = df_work.drop(columns=[target])
    Xt = prep.transform(X_df)
    if hasattr(Xt, "toarray"):
        Xt = np.asarray(Xt.toarray(), dtype=float)
    else:
        Xt = np.asarray(Xt, dtype=float)

    feat_names = [str(x) for x in prep.get_feature_names_out()]
    n_users = Xt.shape[0]
    approx = "shap_zeroing"
    driver_ordered = sorted(shap_rows, key=lambda r: float(r["mean_abs_shap"]), reverse=True)

    positive_class_idx = positive_class_index_for_model(task_type, label_encoder)

    has_value_col = bool(value_column and value_column in df_work.columns)
    value_arr = (
        pd.to_numeric(df_work[value_column], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        if has_value_col
        else np.zeros(n_users, dtype=float)
    )

    proba_mat_full: np.ndarray | None = None
    pred_vals: np.ndarray | None = None
    q75 = 0.0
    actual_bin: np.ndarray | None = None

    if task_type == "classification":
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
            ya_enc = (
                pd.Series(ya_raw).astype(str).str.lower().isin(("1", "true", "yes")).astype(int).to_numpy()
            )
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

    else:
        pred_vals = np.asarray(model.predict(Xt), dtype=float).ravel()
        y_true = pd.to_numeric(df_work[target], errors="coerce").to_numpy()
        target_mean = float(np.nanmean(y_true))
        predicted_mean = float(np.nanmean(pred_vals))

        vmin = float(np.nanmin(pred_vals))
        vmax = float(np.nanmax(pred_vals))
        span = max(vmax - vmin, 1e-12)
        risk_scores = np.clip((pred_vals - vmin) / span, 0.0, 1.0)
        predicted_target_rate = predicted_mean
        target_rate = target_mean

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
            if task_type == "classification":
                t_samples.append(float(np.mean(actual_bin[ix])))
                hr_samples.append(float(np.mean((risk_scores[ix] >= 0.70).astype(float))))
                if has_value_col:
                    rs = risk_scores[ix]
                    va = value_arr[ix]
                    rev_samples.append(float(np.sum(va[rs >= 0.5])))
            else:
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
        _tclo, _tchi = np.percentile(ta, [2.5, 97.5])
        target_ci_lo, target_ci_hi = float(_tclo), float(_tchi)
        _hlo, _hhi = np.percentile(ha, [2.5, 97.5])
        hr_ci_lo, hr_ci_hi = float(_hlo), float(_hhi)
        if has_value_col and rev_samples:
            ra = np.asarray(rev_samples, dtype=float)
            _rlo, _rhi = np.percentile(ra, [2.5, 97.5])
            rev_ci_lo, rev_ci_hi = float(_rlo), float(_rhi)

    headline_dict, lorenz_pts = concentration_headline(concentration_loss)
    gini_val = float(gini_nonnegative(concentration_loss))

    sv_matrix_full: np.ndarray | None = None
    sv_base_val = 0.0
    samp_idx_full: np.ndarray | None = None

    tree_ok = isinstance(
        model,
        (XGBClassifier, XGBRegressor, RandomForestClassifier, RandomForestRegressor),
    )

    if tree_ok:
        sample_n = min(Xt.shape[0], MAX_SHAP_SAMPLES)
        samp_idx_full = rng.choice(Xt.shape[0], size=sample_n, replace=False)
        X_sample = Xt[samp_idx_full]
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
        except Exception as e:
            logger.warning("SHAP matrix for KPI failed: %s", e)
            sv_matrix_full = None
            approx = "linear_share"
    else:
        approx = "linear_share"

    ji_top = 0
    if driver_ordered:
        tn = str(driver_ordered[0]["feature"])
        ji_top = feat_names.index(tn) if tn in feat_names else 0

    risk_segments_out = build_risk_segments(
        masks=masks,
        risk_scores=risk_scores,
        value_arr=value_arr,
        has_value_col=has_value_col,
        sv_matrix_full=sv_matrix_full,
        samp_idx_full=samp_idx_full,
        top_driver_feat_idx=ji_top,
        n_users=n_users,
    )

    total_abs = sum(float(r["mean_abs_shap"]) for r in driver_ordered[:5]) + 1e-15
    drivers_top: list[dict[str, Any]] = []
    top_driver_share_val = (
        float(driver_ordered[0]["mean_abs_shap"]) / total_abs if driver_ordered else 0.0
    )
    for r in driver_ordered[:5]:
        mas = float(r["mean_abs_shap"])
        drivers_top.append({"feature": str(r["feature"]), "mean_abs_shap": mas, "share": mas / total_abs})

    driver_impact: dict[str, Any] = {
        "approximation": approx,
        "per_driver": [],
        "top1": {"delta_target_rate": 0.0, "users_savable": 0, "revenue_recoverable": None},
        "top2": {"delta_target_rate": 0.0, "users_savable": 0, "revenue_recoverable": None},
        "top3": {"delta_target_rate": 0.0, "users_savable": 0, "revenue_recoverable": None},
    }

    feats_topk: list[tuple[str, int]] = []
    for k in range(min(5, len(driver_ordered))):
        fn = str(driver_ordered[k]["feature"])
        jj = feat_index(feat_names, fn)
        if jj is not None:
            feats_topk.append((fn, jj))

    val_samp = value_arr[samp_idx_full] if samp_idx_full is not None else None

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
                if has_value_col:
                    vs = np.asarray(val_samp, dtype=float)
                    rec = float(np.sum(vs * (pb - pa)))
                driver_impact["per_driver"].append(
                    {"feature": name, "delta_target_rate": float(-dtr), "users_savable": users_savable, "revenue_recoverable": rec},
                )
            else:
                pred_full_line = sv_base_val + np.sum(cum_phi, axis=1)
                pred_minus_line = pred_full_line - phi_k
                pv_s = np.asarray(pred_vals, dtype=float)[samp_idx_full]
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
                if has_value_col:
                    vs = np.asarray(val_samp, dtype=float)
                    rec = float(np.sum(vs * np.abs(pv_s - pred_minus_line)))
                driver_impact["per_driver"].append(
                    {"feature": name, "delta_target_rate": float(dtr), "users_savable": users_savable, "revenue_recoverable": rec},
                )

        vals_arr = np.asarray(val_samp, dtype=float) if val_samp is not None else None
        id_list = ids

        driver_impact["top1"] = roll_topk(cum_phi, sv_base_val, id_list, 1, task_type, vals_arr)
        driver_impact["top2"] = roll_topk(cum_phi, sv_base_val, id_list, 2, task_type, vals_arr)
        driver_impact["top3"] = roll_topk(cum_phi, sv_base_val, id_list, 3, task_type, vals_arr)

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

    reliability_info = reliability_block(metrics, cv_metrics, task_type)
    annotate_driver_impact(
        driver_impact,
        feats_topk=feats_topk,
        sv_matrix=sv_matrix_full,
        reliability_tier=reliability_info["tier"],
    )
    intervention_confidence = build_intervention_confidence(
        reliability_tier=reliability_info["tier"],
        driver_impact=driver_impact,
        approximation=str(driver_impact.get("approximation") or approx),
        data_warning_count=int(data_warning_count),
    )

    pv_col = np.asarray(pred_vals if task_type != "classification" else risk_scores)
    out_preds = pd.DataFrame(
        {
            "__prediction": pv_col.ravel(),
            "__expected_loss": concentration_loss.ravel(),
            "__value": value_arr.ravel(),
        }
    )
    if task_type == "classification" and proba_mat_full is not None:
        pc = positive_class_idx if proba_mat_full.shape[1] <= 2 else 1
        out_preds["__proba_positive"] = proba_mat_full[:, min(pc, proba_mat_full.shape[1] - 1)]

    out_path = artifact_dir / "predictions.parquet"
    try:
        out_preds.to_parquet(out_path, index=False)
    except Exception as e:
        logger.warning("predictions parquet write failed: %s", e)

    if impact_rev is not None and rev_ci_lo is not None and rev_ci_hi is not None:
        impact_rev["revenue_at_risk_ci_low"] = rev_ci_lo
        impact_rev["revenue_at_risk_ci_high"] = rev_ci_hi

    target_level: dict[str, Any] = {
        "n_users": n_users,
        "predicted_target_rate": float(predicted_target_rate),
        "high_risk_count": high_risk_count,
        "high_risk_share": high_risk_share,
    }

    if hr_ci_lo is not None and hr_ci_hi is not None:
        target_level["high_risk_share_ci_low"] = hr_ci_lo
        target_level["high_risk_share_ci_high"] = hr_ci_hi

    if task_type == "classification":
        target_level["target_rate"] = float(target_rate)
        if target_ci_lo is not None and target_ci_hi is not None:
            target_level["target_rate_ci_low"] = target_ci_lo
            target_level["target_rate_ci_high"] = target_ci_hi
    else:
        target_level["target_mean"] = float(target_rate)
        target_level["predicted_mean"] = float(predicted_target_rate)
        if target_ci_lo is not None and target_ci_hi is not None:
            target_level["target_mean_ci_low"] = target_ci_lo
            target_level["target_mean_ci_high"] = target_ci_hi

    rev_at_risk = None
    if impact_rev is not None and impact_rev.get("revenue_at_risk") is not None:
        try:
            rev_at_risk = float(impact_rev["revenue_at_risk"])
        except (TypeError, ValueError):
            rev_at_risk = None

    return {
        "target_level": target_level,
        "impact_revenue": impact_rev,
        "concentration": {
            "lorenz_points": lorenz_pts,
            "headline": headline_dict,
            "gini": gini_val,
            "interpretation": concentration_interpretation(
                top_pct_users=float(headline_dict["top_pct_users"]),
                share_of_risk=float(headline_dict["share_of_risk"]),
                gini=gini_val,
                n_users=n_users,
            ),
            "pareto_cuts": pareto_cut_table(
                lorenz_points=lorenz_pts,
                n_users=n_users,
                revenue_at_risk=rev_at_risk,
            ),
        },
        "risk_segments": risk_segments_out,
        "drivers": drivers_top,
        "top_driver_share": float(top_driver_share_val),
        "driver_impact": driver_impact,
        "reliability": reliability_info,
        "intervention_confidence": intervention_confidence,
    }
