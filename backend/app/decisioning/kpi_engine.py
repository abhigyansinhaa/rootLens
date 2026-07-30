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
from sklearn.pipeline import Pipeline as SkPipeline
from sklearn.preprocessing import LabelEncoder

from app.decisioning.counterfactual import annotate_driver_impact
from app.decisioning.kpis.concentration import concentration_headline, gini_nonnegative
from app.decisioning.kpis.concentration_narrative import concentration_interpretation, pareto_cut_table
from app.decisioning.kpis.driver_impact import feat_index
from app.decisioning.kpis.engine_helpers import (
    bootstrap_confidence_intervals,
    compute_classification_stats,
    compute_counterfactual_impacts,
    compute_regression_stats,
    compute_shap_matrix,
)
from app.decisioning.kpis.intervention_confidence import build_intervention_confidence
from app.decisioning.kpis.reliability import reliability_block
from app.decisioning.kpis.segment_value import build_risk_segments
from app.pipelines.common import TaskType, positive_class_index_for_model

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
        dataset_hash: str | None = None,
        schema_hash: str | None = None,
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
            dataset_hash=dataset_hash,
            schema_hash=schema_hash,
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
    dataset_hash: str | None = None,
    schema_hash: str | None = None,
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
        dataset_hash=dataset_hash,
        schema_hash=schema_hash,
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
    dataset_hash: str | None = None,
    schema_hash: str | None = None,
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
    driver_ordered = sorted(shap_rows, key=lambda r: float(r["mean_abs_shap"]), reverse=True)

    positive_class_idx = positive_class_index_for_model(task_type, label_encoder)

    has_value_col = bool(value_column and value_column in df_work.columns)
    value_arr = (
        pd.to_numeric(df_work[value_column], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        if has_value_col
        else np.zeros(n_users, dtype=float)
    )

    if task_type == "classification":
        stats = compute_classification_stats(
            model=model,
            Xt=Xt,
            df_work=df_work,
            target=target,
            value_arr=value_arr,
            has_value_col=has_value_col,
            positive_class_idx=positive_class_idx,
            label_encoder=label_encoder,
            n_users=n_users,
        )
    else:
        stats = compute_regression_stats(
            model=model,
            Xt=Xt,
            df_work=df_work,
            target=target,
            value_arr=value_arr,
            has_value_col=has_value_col,
            n_users=n_users,
        )

    target_ci_lo, target_ci_hi, hr_ci_lo, hr_ci_hi, rev_ci_lo, rev_ci_hi = bootstrap_confidence_intervals(
        rng=rng,
        task_type=task_type,
        n_users=n_users,
        actual_bin=stats["actual_bin"],
        risk_scores=stats["risk_scores"],
        has_value_col=has_value_col,
        value_arr=value_arr,
        df_work=df_work,
        target=target,
        pred_vals=stats["pred_vals"],
    )

    headline_dict, lorenz_pts = concentration_headline(stats["concentration_loss"])
    gini_val = float(gini_nonnegative(stats["concentration_loss"]))

    sv_matrix_full, sv_base_val, samp_idx_full, approx = compute_shap_matrix(
        model=model,
        Xt=Xt,
        task_type=task_type,
        positive_class_idx=positive_class_idx,
        rng=rng,
        dataset_hash=dataset_hash,
        schema_hash=schema_hash,
    )

    ji_top = 0
    if driver_ordered:
        tn = str(driver_ordered[0]["feature"])
        ji_top = feat_index(feat_names, tn) if tn in feat_names else 0

    risk_segments_out = build_risk_segments(
        masks=stats["masks"],
        risk_scores=stats["risk_scores"],
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

    compute_counterfactual_impacts(
        driver_impact=driver_impact,
        approx=approx,
        sv_matrix_full=sv_matrix_full,
        samp_idx_full=samp_idx_full,
        feats_topk=feats_topk,
        task_type=task_type,
        sv_base_val=sv_base_val,
        has_value_col=has_value_col,
        val_samp=val_samp,
        pred_vals=stats["pred_vals"],
        q75=stats["q75"],
        driver_ordered=driver_ordered,
        predicted_target_rate=stats["predicted_target_rate"],
    )

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

    pv_col = np.asarray(stats["pred_vals"] if task_type != "classification" else stats["risk_scores"])
    out_preds = pd.DataFrame(
        {
            "__prediction": pv_col.ravel(),
            "__expected_loss": stats["concentration_loss"].ravel(),
            "__value": value_arr.ravel(),
        }
    )
    if task_type == "classification" and stats["proba_mat_full"] is not None:
        pc = positive_class_idx if stats["proba_mat_full"].shape[1] <= 2 else 1
        out_preds["__proba_positive"] = stats["proba_mat_full"][:, min(pc, stats["proba_mat_full"].shape[1] - 1)]

    out_path = artifact_dir / "predictions.parquet"
    try:
        out_preds.to_parquet(out_path, index=False)
    except Exception as e:
        logger.warning("predictions parquet write failed: %s", e)

    impact_rev = stats["impact_rev"]
    if impact_rev is not None and rev_ci_lo is not None and rev_ci_hi is not None:
        impact_rev["revenue_at_risk_ci_low"] = rev_ci_lo
        impact_rev["revenue_at_risk_ci_high"] = rev_ci_hi

    target_level: dict[str, Any] = {
        "n_users": n_users,
        "predicted_target_rate": float(stats["predicted_target_rate"]),
        "high_risk_count": stats["high_risk_count"],
        "high_risk_share": stats["high_risk_share"],
    }

    if hr_ci_lo is not None and hr_ci_hi is not None:
        target_level["high_risk_share_ci_low"] = hr_ci_lo
        target_level["high_risk_share_ci_high"] = hr_ci_hi

    if task_type == "classification":
        target_level["target_rate"] = float(stats["target_rate"])
        if target_ci_lo is not None and target_ci_hi is not None:
            target_level["target_rate_ci_low"] = target_ci_lo
            target_level["target_rate_ci_high"] = target_ci_hi
    else:
        target_level["target_mean"] = float(stats["target_rate"])
        target_level["predicted_mean"] = float(stats["predicted_target_rate"])
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
