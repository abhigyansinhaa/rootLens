import json
import logging
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal, get_db
from app.deps import get_current_user
from app.jobs import run_analysis
from app.models import Analysis, Dataset, User
from app.rate_limit import limiter
from app.schemas import AnalysisCreate, AnalysisListItem, AnalysisOut
from app.storage import remove_artifact_dir

router = APIRouter(tags=["analyses"])
logger = logging.getLogger(__name__)


def _compact_kpis(report: dict[str, Any] | None) -> dict[str, Any] | None:
    if not report:
        return None
    kpis = report.get("kpis")
    if not kpis:
        return None
    conc = kpis.get("concentration") or {}
    di = kpis.get("driver_impact") or {}
    return {
        "headline": conc.get("headline"),
        "top2_impact": di.get("top2"),
        "approximation": di.get("approximation"),
    }


def _is_numeric_value_column(ds_cols: list[dict[str, Any]], name: str) -> bool:
    for c in ds_cols:
        if c.get("name") != name:
            continue
        dt = str(c.get("dtype", "")).lower()
        return (
            "float" in dt
            or "int" in dt
            or dt in ("float64", "int64", "float32", "int32")
            or "decimal" in dt
        )
    return False


def _analysis_to_out(a: Analysis) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": a.id,
        "dataset_id": a.dataset_id,
        "target": a.target,
        "datetime_column": getattr(a, "datetime_column", None),
        "value_column": getattr(a, "value_column", None),
        "task_type": a.task_type,
        "status": a.status,
        "error": a.error,
        "created_at": a.created_at,
        "completed_at": a.completed_at,
        "metrics": json.loads(a.metrics_json) if a.metrics_json else None,
        "model_metadata": json.loads(a.model_metadata_json) if getattr(a, "model_metadata_json", None) else None,
        "insights": json.loads(a.insights_json) if a.insights_json else None,
        "recommendations": json.loads(a.recommendations_json) if a.recommendations_json else None,
        "feature_importance": None,
        "shap_summary": json.loads(a.shap_json) if a.shap_json else None,
        "shap_summary_image_url": None,
        "report": json.loads(a.report_json) if getattr(a, "report_json", None) else None,
    }
    if a.shap_json:
        shap = json.loads(a.shap_json)
        base["feature_importance"] = [
            {
                "feature": r["feature"],
                "importance": r.get("xgb_importance", r["mean_abs_shap"]),
                "mean_abs_shap": r["mean_abs_shap"],
            }
            for r in shap
        ]
        base["shap_summary"] = shap
    if a.status == "completed" and a.id:
        base["shap_summary_image_url"] = f"analyses/{a.id}/artifacts/shap_summary.png"
    return base


def _analysis_list_item(a: Analysis, dataset_name: str) -> dict[str, Any]:
    rep = json.loads(a.report_json) if getattr(a, "report_json", None) else None
    return {
        "id": a.id,
        "dataset_id": a.dataset_id,
        "dataset_name": dataset_name,
        "target": a.target,
        "datetime_column": getattr(a, "datetime_column", None),
        "task_type": a.task_type,
        "status": a.status,
        "value_column": getattr(a, "value_column", None),
        "created_at": a.created_at,
        "completed_at": a.completed_at,
        "kpi_summary": _compact_kpis(rep),
    }


def _job_wrapper(analysis_id: int, test_size: float, max_rows: int | None) -> None:
    db = SessionLocal()
    try:
        run_analysis(db, analysis_id, test_size, max_rows)
    finally:
        db.close()


@router.post("/datasets/{dataset_id}/analyses", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def create_analysis(
    request: Request,
    dataset_id: int,
    body: AnalysisCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Any:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cols_raw: list[dict[str, Any]] = json.loads(ds.columns_json)
    col_names = {c["name"] for c in cols_raw}
    if body.target not in col_names:
        raise HTTPException(status_code=400, detail=f"Target '{body.target}' is not a column in this dataset")

    val_col: str | None = None
    if body.value_column and body.value_column.strip():
        vc = body.value_column.strip()
        if vc not in col_names:
            raise HTTPException(status_code=400, detail=f"Value column '{vc}' is not a column in this dataset")
        if vc == body.target:
            raise HTTPException(status_code=400, detail="Value column must differ from the target column")
        if not _is_numeric_value_column(cols_raw, vc):
            raise HTTPException(
                status_code=400,
                detail=f"Value column '{vc}' must be numeric for revenue / value KPIs",
            )
        val_col = vc

    dt_col: str | None = None
    if body.datetime_column and body.datetime_column.strip():
        dc = body.datetime_column.strip()
        if dc not in col_names:
            raise HTTPException(status_code=400, detail=f"Datetime column '{dc}' is not a column in this dataset")
        if dc == body.target:
            raise HTTPException(status_code=400, detail="Datetime column must differ from the target column")
        if dc == val_col:
            raise HTTPException(status_code=400, detail="Datetime column must differ from the value column")
        dt_col = dc

    analysis = Analysis(
        dataset_id=ds.id,
        target=body.target,
        datetime_column=dt_col,
        value_column=val_col,
        status="queued",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    if settings.redis_url:
        try:
            from app.queue import enqueue_analysis

            enqueue_analysis(analysis.id, body.test_size, body.max_rows)
        except Exception:
            logger.exception("RQ enqueue failed; falling back to BackgroundTasks")
            background_tasks.add_task(_job_wrapper, analysis.id, body.test_size, body.max_rows)
    else:
        background_tasks.add_task(_job_wrapper, analysis.id, body.test_size, body.max_rows)
    return AnalysisOut.model_validate(_analysis_to_out(analysis))


@router.get("/analyses", response_model=list[AnalysisListItem])
def list_analyses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Any:
    rows = (
        db.query(Analysis, Dataset)
        .join(Dataset, Analysis.dataset_id == Dataset.id)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [AnalysisListItem.model_validate(_analysis_list_item(a, ds.name)) for a, ds in rows]


@router.get("/datasets/{dataset_id}/analyses", response_model=list[AnalysisListItem])
def list_dataset_analyses(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Any:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    rows = (
        db.query(Analysis)
        .filter(Analysis.dataset_id == ds.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [AnalysisListItem.model_validate(_analysis_list_item(a, ds.name)) for a in rows]


@router.get("/analyses/{analysis_id}/artifacts/{filename}")
def download_analysis_artifact(
    analysis_id: int,
    filename: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    allowed = {"shap_summary.png", "predictions.parquet"}
    if safe_name not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported artifact")

    a = db.get(Analysis, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    ds = db.get(Dataset, a.dataset_id)
    if ds is None or ds.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    path = settings.artifacts_dir / str(analysis_id) / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(path)


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(
    analysis_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Any:
    a = db.get(Analysis, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    ds = db.get(Dataset, a.dataset_id)
    if ds is None or ds.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return AnalysisOut.model_validate(_analysis_to_out(a))


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    a = db.get(Analysis, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    ds = db.get(Dataset, a.dataset_id)
    if ds is None or ds.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    remove_artifact_dir(analysis_id)
    db.delete(a)
    db.commit()
