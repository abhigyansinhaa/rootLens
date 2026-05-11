"""Background analysis job: profile, train, explain, persist."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.decisioning import messages as user_msg
from app.decisioning.governance import build_governance_block
from app.decisioning.insights import aggregate_shap_by_column, build_insights, insights_to_json
from app.decisioning.kpis import compute_kpis
from app.decisioning.recommend import build_recommendations
from app.domain.models import Analysis, Dataset
from app.infrastructure.artifact_manifest import write_artifact_manifest
from app.infrastructure.audit_logger import write_event as audit_write_event
from app.infrastructure.storage import (
    analysis_artifact_dir,
    ensure_dirs,
    has_parquet_sidecar,
    parquet_sidecar_path,
)
from app.pipelines import PIPELINE_VERSION
from app.pipelines.explain import compute_explanations_with_fallback, shap_json_dump
from app.pipelines.pipeline import (
    ENCODER_VERSION,
    RANDOM_STATE,
    train_model_with_fallback,
    training_work_frame,
)
from app.pipelines.profile import profile_dataset_for_target


def _schema_hash_from_columns(columns_json: str) -> str:
    """Stable fingerprint of the dataset schema: sorted (name, dtype) pairs.

    Stored on `Analysis.schema_hash` so we can detect dataset schema drift even
    when the underlying bytes change (e.g. user reuploads with a new file).
    """
    try:
        cols: list[dict[str, Any]] = json.loads(columns_json)
    except Exception:
        return ""
    pairs = sorted((str(c.get("name", "")), str(c.get("dtype", ""))) for c in cols)
    blob = "|".join(f"{n}::{t}" for n, t in pairs).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()

logger = logging.getLogger(__name__)


def _load_df(ds: Dataset) -> pd.DataFrame:
    if ds.file_format == "csv":
        if has_parquet_sidecar(ds.storage_path, ds.file_format):
            try:
                return pd.read_parquet(parquet_sidecar_path(ds.storage_path))
            except Exception:
                logger.info("Parquet sidecar unreadable for %s; falling back to CSV", ds.storage_path)
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

    analysis.pipeline_version = PIPELINE_VERSION
    analysis.encoder_version = ENCODER_VERSION
    analysis.schema_hash = _schema_hash_from_columns(dataset.columns_json)
    analysis.dataset_hash = dataset.content_hash
    analysis.status = "profiling"
    db.commit()

    audit_write_event(
        "analysis.started",
        {
            "analysis_id": analysis.id,
            "dataset_id": analysis.dataset_id,
            "user_id": dataset.user_id,
            "target": analysis.target,
            "pipeline_version": analysis.pipeline_version,
            "encoder_version": analysis.encoder_version,
            "dataset_hash": analysis.dataset_hash,
            "schema_hash": analysis.schema_hash,
        },
    )

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
        analysis.status = "training"
        db.commit()
        result, training_fallback_notes = train_model_with_fallback(
            df,
            analysis.target,
            test_size=test_size,
            max_rows=max_rows,
            data_warnings=merged_warnings,
            datetime_column=analysis.datetime_column,
        )
        art_dir = analysis_artifact_dir(analysis_id)
        analysis.status = "explaining"
        db.commit()
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

        analysis.status = "decisioning"
        db.commit()
        degraded: list[str] = []
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
            degraded.append("kpis")

        if explanation_fallback_notes:
            degraded.append("explanations")
        if training_fallback_notes:
            degraded.append("training")
        if plot_err:
            degraded.append("shap_plot")

        if degraded:
            report["degraded_components"] = sorted(set(degraded))

        report["governance"] = build_governance_block(
            data_warnings=list(result.data_warnings or []),
            fallbacks=fallback_notes,
            degraded_components=sorted(set(degraded)),
            kpis=report.get("kpis") if isinstance(report.get("kpis"), dict) else None,
            pipeline_version=analysis.pipeline_version,
            encoder_version=analysis.encoder_version,
            dataset_hash=analysis.dataset_hash,
            schema_hash=analysis.schema_hash,
            dataset_columns=[c.get("name") for c in column_meta if c.get("name")],
            db=db,
            user_id=dataset.user_id,
            dataset_id=dataset.id,
        )

        analysis.task_type = result.task_type
        analysis.metrics_json = json.dumps(result.metrics)
        analysis.model_metadata_json = json.dumps(result.model_metadata)
        analysis.insights_json = insights_to_json(insights)
        analysis.recommendations_json = json.dumps(recs)
        analysis.shap_json = shap_json_dump(shap_rows)
        analysis.report_json = json.dumps(report)
        analysis.artifacts_path = str(art_dir.resolve())
        analysis.error = None
        analysis.status = "completed_with_warnings" if degraded else "completed"
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()

        write_artifact_manifest(
            art_dir,
            pipeline_version=analysis.pipeline_version or PIPELINE_VERSION,
            encoder_version=analysis.encoder_version or ENCODER_VERSION,
            analysis_id=analysis.id,
            dataset_hash=analysis.dataset_hash,
        )
        audit_write_event(
            "analysis.completed",
            {
                "analysis_id": analysis.id,
                "dataset_id": analysis.dataset_id,
                "user_id": dataset.user_id,
                "status": analysis.status,
                "task_type": analysis.task_type,
                "pipeline_version": analysis.pipeline_version,
                "encoder_version": analysis.encoder_version,
                "dataset_hash": analysis.dataset_hash,
                "schema_hash": analysis.schema_hash,
                "degraded_components": report.get("degraded_components", []),
                "metrics_summary": _summarize_metrics(result.metrics),
                "model_kind": result.model_kind,
            },
        )
    except MemoryError:
        logger.exception("Analysis %s ran out of memory", analysis_id)
        analysis.status = "failed"
        analysis.failed_reason = "oom"
        analysis.error = (
            "We ran out of memory while analyzing this dataset. Try again with a "
            "smaller `max_rows` cap, or remove very wide categorical columns "
            "from the upload."
        )
        analysis.report_json = json.dumps(
            {
                "user_message": analysis.error,
                "fallbacks": [],
                "failed_reason": "oom",
            }
        )
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()
        audit_write_event(
            "analysis.failed",
            {
                "analysis_id": analysis.id,
                "dataset_id": analysis.dataset_id,
                "user_id": dataset.user_id,
                "failed_reason": "oom",
            },
        )
    except Exception as e:
        logger.exception("Analysis %s failed", analysis_id)
        analysis.status = "failed"
        analysis.failed_reason = _classify_failure_reason(e)
        analysis.error = user_msg.failure_message_for_user()
        analysis.report_json = json.dumps(
            {
                "user_message": user_msg.GOODWILL_FAILURE_SHORT,
                "fallbacks": [],
                "failed_reason": analysis.failed_reason,
            }
        )
        analysis.completed_at = datetime.now(timezone.utc)
        db.commit()
        audit_write_event(
            "analysis.failed",
            {
                "analysis_id": analysis.id,
                "dataset_id": analysis.dataset_id,
                "user_id": dataset.user_id,
                "failed_reason": analysis.failed_reason,
                "exception_type": type(e).__name__,
            },
        )


def _summarize_metrics(metrics: dict[str, float] | None) -> dict[str, float]:
    """Return a tiny subset of model metrics safe to drop into the audit log."""
    if not metrics:
        return {}
    keep = ("accuracy", "f1_macro", "roc_auc", "r2", "mae", "rmse")
    out: dict[str, float] = {}
    for k in keep:
        v = metrics.get(k)
        if v is None:
            continue
        try:
            out[k] = float(v)
        except (TypeError, ValueError):
            continue
    return out


def _classify_failure_reason(err: BaseException) -> str:
    """Map a top-level exception to a short tag stored on `Analysis.failed_reason`.

    Kept deliberately tiny: the UI keys off this tag for tailored copy, while the
    full message stays in `Analysis.error`. New tags should be additive.
    """
    msg = (str(err) or "").lower()
    name = type(err).__name__.lower()
    if "memory" in msg or "memoryerror" in name:
        return "oom"
    if "timeout" in name or "timeout" in msg:
        return "timeout"
    if isinstance(err, ValueError):
        return "data_error"
    return "internal_error"
