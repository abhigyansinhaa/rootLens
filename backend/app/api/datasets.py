import json
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.domain.models import Analysis, Dataset, User
from app.domain.schemas import ColumnSchema, DatasetOut, DatasetProfileOut, DatasetProfileRequest
from app.infrastructure.db import get_db
from app.infrastructure.storage import (
    content_hash_of_bytes,
    delete_file,
    ensure_dirs,
    has_parquet_sidecar,
    parquet_sidecar_path,
    remove_artifact_dir,
    save_upload,
)
from app.pipelines.profile import profile_dataset_for_target

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _infer_columns(df: pd.DataFrame) -> list[ColumnSchema]:
    cols: list[ColumnSchema] = []
    n = len(df)
    for c in df.columns:
        s = df[c]
        null_ratio = float(s.isna().mean()) if n else 0.0
        n_unique = int(s.nunique(dropna=True))
        dtype = str(s.dtype)
        sample = s.dropna().head(5).astype(str).tolist()
        cols.append(
            ColumnSchema(
                name=str(c),
                dtype=dtype,
                null_ratio=round(null_ratio, 4),
                n_unique=n_unique,
                sample_values=sample,
            )
        )
    return cols


def _load_dataframe(path: str, fmt: str) -> pd.DataFrame:
    if fmt == "csv":
        if has_parquet_sidecar(path, fmt):
            try:
                return pd.read_parquet(parquet_sidecar_path(path))
            except Exception:
                pass
        return pd.read_csv(path, low_memory=False)
    if fmt == "parquet":
        return pd.read_parquet(path)
    raise ValueError("Unsupported format")


def _dataset_to_out(ds: Dataset) -> DatasetOut:
    columns = [ColumnSchema.model_validate(c) for c in json.loads(ds.columns_json)]
    return DatasetOut(
        id=ds.id,
        name=ds.name,
        filename=ds.filename,
        file_format=ds.file_format,
        rows=ds.rows,
        cols=ds.cols,
        columns=columns,
        created_at=ds.created_at,
    )


@router.post("", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    name: str | None = Form(None),
) -> Any:
    ensure_dirs()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    content_hash = content_hash_of_bytes(content)
    existing = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id, Dataset.content_hash == content_hash)
        .first()
    )
    if existing is not None:
        return _dataset_to_out(existing)

    try:
        storage_path, fmt = save_upload(file.filename or "data.csv", content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        df = _load_dataframe(storage_path, fmt)
    except Exception as e:
        delete_file(storage_path)
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e!s}") from e

    if df.empty or df.shape[1] == 0:
        delete_file(storage_path)
        raise HTTPException(status_code=400, detail="Dataset has no columns or rows")

    columns = _infer_columns(df)
    display_name = name.strip() if name and name.strip() else (file.filename or "dataset")

    ds = Dataset(
        user_id=current_user.id,
        name=display_name,
        filename=file.filename or "upload",
        storage_path=storage_path,
        file_format=fmt,
        rows=int(len(df)),
        cols=int(df.shape[1]),
        columns_json=json.dumps([c.model_dump() for c in columns]),
        content_hash=content_hash,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return _dataset_to_out(ds)


@router.get("", response_model=list[DatasetOut])
def list_datasets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Any:
    rows = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [_dataset_to_out(ds) for ds in rows]


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Any:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return _dataset_to_out(ds)


@router.post("/{dataset_id}/profile", response_model=DatasetProfileOut)
def profile_dataset_target(
    dataset_id: int,
    body: DatasetProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Any:
    """Run dataset + target suitability checks without training."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    df = _load_dataframe(ds.storage_path, ds.file_format)
    column_meta = json.loads(ds.columns_json)
    pr = profile_dataset_for_target(df, body.target, column_meta)
    return DatasetProfileOut(
        ok=pr.ok,
        blocking_errors=pr.blocking_errors,
        warnings=pr.warnings,
        dataset_health=pr.dataset_health,
        target_suitability=pr.target_suitability,
        task_type_hint=pr.task_type,
    )


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
) -> dict[str, Any]:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    limit = min(max(limit, 1), 200)
    if ds.file_format == "csv":
        if has_parquet_sidecar(ds.storage_path, ds.file_format):
            try:
                df = pd.read_parquet(parquet_sidecar_path(ds.storage_path))
                df = df.head(limit)
            except Exception:
                df = pd.read_csv(ds.storage_path, nrows=limit, low_memory=False)
        else:
            df = pd.read_csv(ds.storage_path, nrows=limit, low_memory=False)
    else:
        df = pd.read_parquet(ds.storage_path)
        df = df.head(limit)
    return {"rows": df.fillna("").astype(str).to_dict(orient="records"), "columns": list(df.columns)}


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    for a in db.query(Analysis).filter(Analysis.dataset_id == ds.id).all():
        remove_artifact_dir(a.id)
        db.delete(a)
    delete_file(ds.storage_path)
    db.delete(ds)
    db.commit()
