"""Regression test: legacy package paths (import shims) remain importable.

Keeps `app.models`, `app.ml.*`, `app.routers`, etc. working for callers that
have not migrated to `app.api` / `app.pipelines` / `app.infrastructure`.
"""

from __future__ import annotations


def test_legacy_import_paths_still_work():
    from app.artifact_manifest import write_artifact_manifest  # noqa: F401
    from app.audit_logger import write_event  # noqa: F401
    from app.db import Base, SessionLocal, get_db  # noqa: F401
    from app.ml import PIPELINE_VERSION  # noqa: F401
    from app.ml import messages  # noqa: F401
    from app.ml.encoders import FrequencyEncoder, OOFTargetEncoder  # noqa: F401
    from app.ml.explain import (  # noqa: F401
        MAX_SHAP_SAMPLES,
        compute_explanations_with_fallback,
    )
    from app.ml.insights import build_insights  # noqa: F401
    from app.ml.kpis import compute_kpis  # noqa: F401
    from app.ml.pipeline import ENCODER_VERSION, train_model  # noqa: F401
    from app.ml.profile import profile_dataset_for_target  # noqa: F401
    from app.ml.recommend import build_recommendations  # noqa: F401
    from app.models import Analysis, Dataset, User  # noqa: F401
    from app.queue import enqueue_analysis  # noqa: F401
    from app.routers import analyses, auth, datasets  # noqa: F401
    from app.schemas import AnalysisOut  # noqa: F401
    from app.storage import ensure_dirs, save_upload  # noqa: F401
    from app.worker_tasks import run_analysis_task  # noqa: F401

    assert PIPELINE_VERSION
    assert ENCODER_VERSION
