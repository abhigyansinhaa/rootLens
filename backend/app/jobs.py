"""Background analysis job: profile, train, explain, persist."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.orm import Session

from app.ml import messages as user_msg
from app.ml.explain import compute_explanations_with_fallback, shap_json_dump
from app.ml.insights import aggregate_shap_by_column, build_insights, insights_to_json
from app.ml.kpis import compute_kpis
from app.ml.pipeline import RANDOM_STATE, train_model_with_fallback, training_work_frame
from app.ml.profile import profile_dataset_for_target
from app.ml.recommend import build_recommendations
from app.models import Analysis, Dataset
from app.storage import analysis_artifact_dir, ensure_dirs

logger = logging.getLogger(__name__)


def _load_df(ds: Dataset) -> pd.DataFrame:
    if ds.file_format == "csv":
        return pd.read_csv(ds.storage_path, low_memory=False)
    return pd.read_parquet(ds.storage_path)


def run_analysis(db: Session, analysis_id: int, test_size: float, max_rows: int | None) -> None:
    ensure_dirs()
    analysis = db.get(Analysis, analysis_id)
    if analysis is None:
        return

    dataset = db.get(Dataset, analysis.dataset_id)
    if dataset is None:
        analysis.status = "failed"
        analysis.error = user_msg.failure_message_for_user("Dataset was removed.")
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()
        return

    analysis.status = "running"
    db.commit()

    try:
        df = _load_df(dataset)
        column_meta = json.loads(dataset.columns_json)

        profile = profile_dataset_for_target(df, analysis.target, column_meta)
        if not profile.ok:
            analysis.status = "failed"
            analysis.error = user_msg.failure_message_for_user(
                profile.blocking_errors[0] if profile.blocking_errors else None
            )
            analysis.report_json = json.dumps(
                {
                    "profile": profile.to_report_section(),
                    "user_message": user_msg.GOODWILL_FAILURE_SHORT,
                }
            )
            analysis.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        merged_warnings = list(profile.warnings)
        result, training_fallback_notes = train_model_with_fallback(
            df,
            analysis.target,
            test_size=test_size,
            max_rows=max_rows,
            data_warnings=merged_warnings,
            datetime_column=analysis.datetime_column,
        )
        art_dir = analysis_artifact_dir(analysis_id)
        shap_rows, plot_err, explanation_fallback_notes = compute_explanations_with_fallback(
            result.model,
            result.X_test,
            result.feature_names,
            art_dir,
            model_kind=result.model_kind,
            task_type=result.task_type,
            y_test=result.y_test,
            X_test_raw=result.X_test_df,
        )

        fallback_notes = list(training_fallback_notes) + list(explanation_fallback_notes)
        if plot_err:
            logger.info("SHAP plot skipped for analysis %s: %s", analysis_id, plot_err[:500])
            fallback_notes.append(user_msg.GOODWILL_PLOT_SKIPPED)

        stability_note: str | None = None
        if result.cv_metrics:
            if "cv_accuracy_std" in result.cv_metrics and result.cv_metrics["cv_accuracy_std"] > 0.15:
                stability_note = "Cross-validation accuracy varies across folds; drivers may be less stable."
            if "cv_r2_std" in result.cv_metrics and result.cv_metrics["cv_r2_std"] > 0.2:
                stability_note = "Cross-validation R² varies across folds; drivers may be less stable."

        insights = build_insights(
            df,
            analysis.target,
            result.task_type,
            shap_rows,
            column_meta,
            confidence=result.confidence,
            explanation_stability=stability_note,
        )
        recs = build_recommendations(
            result.task_type,
            analysis.target,
            shap_rows,
            column_meta,
            result.metrics,
            confidence=result.confidence,
            model_kind=result.model_kind,
            validation_strategy=result.validation_strategy,
        )
        if fallback_notes:
            recs = [
                "Thanks for your patience — we applied a backup step so you still get actionable drivers.",
                *recs,
            ]

        grouped = aggregate_shap_by_column(shap_rows, top_k=12)

        user_message = user_msg.combined_user_message(fallback_notes)

        report: dict[str, object] = {
            "profile": profile.to_report_section(),
            "model": {
                "kind": result.model_kind,
                "validation_strategy": result.validation_strategy,
                "confidence": result.confidence,
                "cv_metrics": result.cv_metrics,
            },
            "grouped_drivers": grouped,
            "data_warnings": result.data_warnings,
            "fallbacks": fallback_notes,
            "user_message": user_message,
        }

        work, _, _ = training_work_frame(
            df,
            analysis.target,
            max_rows,
            RANDOM_STATE,
            analysis.datetime_column,
            merged_warnings,
        )

        value_col = analysis.value_column
        if value_col and value_col not in work.columns:
            value_col = None
        if value_col and value_col == analysis.target:
            value_col = None

        try:
            kpis = compute_kpis(
                work,
                analysis.target,
                result.task_type,
                result.model,
                result.label_encoder,
                shap_rows,
                result.metrics,
                result.cv_metrics,
                value_col,
                art_dir,
            )
            report["kpis"] = kpis
        except Exception as e:
            logger.warning("KPI computation failed for analysis %s: %s", analysis_id, e, exc_info=True)

        analysis.task_type = result.task_type
        analysis.metrics_json = json.dumps(result.metrics)
        analysis.model_metadata_json = json.dumps(result.model_metadata)
        analysis.insights_json = insights_to_json(insights)
        analysis.recommendations_json = json.dumps(recs)
        analysis.shap_json = shap_json_dump(shap_rows)
        analysis.report_json = json.dumps(report)
        analysis.artifacts_path = str(art_dir.resolve())
        analysis.error = None
        analysis.status = "completed"
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        logger.exception("Analysis %s failed", analysis_id)
        analysis.status = "failed"
        analysis.error = user_msg.failure_message_for_user()
        analysis.report_json = json.dumps(
            {
                "user_message": user_msg.GOODWILL_FAILURE_SHORT,
                "fallbacks": [],
            }
        )
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()
