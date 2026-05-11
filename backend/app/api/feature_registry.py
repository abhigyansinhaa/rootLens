"""Feature registry endpoints (governance annotations for dataset columns).

This is a thin CRUD over :class:`FeatureRegistryEntry` — not a feature store.
The router lives alongside other API resources and is mounted in
``app.main`` under the existing ``/api`` prefix.

Endpoints
---------
* ``GET    /api/datasets/{dataset_id}/feature-registry`` — list governance
  rows joined to the dataset's known columns. Returns one entry per column
  with ``is_governed`` and ``is_in_dataset`` flags so the UI can show
  coverage at a glance.
* ``PATCH  /api/datasets/{dataset_id}/feature-registry/{feature_name}`` —
  upsert governance fields (owner / business_definition / allowed_use / notes)
  and optionally bump ``last_reviewed_at``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.domain.models import Dataset, FeatureRegistryEntry, User
from app.domain.schemas import (
    FeatureRegistryEntryOut,
    FeatureRegistryEntryPatch,
    FeatureRegistryListOut,
)
from app.infrastructure.db import get_db

router = APIRouter(prefix="/datasets/{dataset_id}/feature-registry", tags=["feature-registry"])


def _owned_dataset(db: Session, dataset_id: int, user: User) -> Dataset:
    ds = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.user_id == user.id)
        .first()
    )
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


def _dataset_columns(ds: Dataset) -> list[str]:
    try:
        cols = json.loads(ds.columns_json or "[]")
    except Exception:
        return []
    return [str(c.get("name")) for c in cols if c.get("name")]


def _entry_to_out(entry: FeatureRegistryEntry, in_dataset: bool) -> FeatureRegistryEntryOut:
    return FeatureRegistryEntryOut(
        feature_name=entry.feature_name,
        owner=entry.owner,
        business_definition=entry.business_definition,
        allowed_use=entry.allowed_use,
        notes=entry.notes,
        last_reviewed_at=entry.last_reviewed_at,
        is_governed=any(
            v is not None and str(v).strip() != ""
            for v in (entry.owner, entry.business_definition, entry.allowed_use, entry.notes)
        ),
        is_in_dataset=in_dataset,
    )


@router.get("", response_model=FeatureRegistryListOut)
def list_entries(
    dataset_id: Annotated[int, Path(ge=1)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FeatureRegistryListOut:
    ds = _owned_dataset(db, dataset_id, current_user)
    feature_columns = _dataset_columns(ds)

    existing: dict[str, FeatureRegistryEntry] = {
        e.feature_name: e
        for e in db.query(FeatureRegistryEntry)
        .filter(
            FeatureRegistryEntry.user_id == current_user.id,
            FeatureRegistryEntry.dataset_id == dataset_id,
        )
        .all()
    }

    entries: list[FeatureRegistryEntryOut] = []
    governed_in_dataset = 0
    for col in feature_columns:
        e = existing.get(col)
        if e is None:
            entries.append(
                FeatureRegistryEntryOut(
                    feature_name=col,
                    is_governed=False,
                    is_in_dataset=True,
                )
            )
        else:
            out = _entry_to_out(e, in_dataset=True)
            entries.append(out)
            if out.is_governed:
                governed_in_dataset += 1

    for name, e in existing.items():
        if name not in feature_columns:
            entries.append(_entry_to_out(e, in_dataset=False))

    coverage = float(governed_in_dataset) / float(len(feature_columns)) if feature_columns else 0.0
    return FeatureRegistryListOut(
        dataset_id=dataset_id,
        entries=entries,
        coverage=coverage,
    )


@router.patch("/{feature_name}", response_model=FeatureRegistryEntryOut)
def upsert_entry(
    dataset_id: Annotated[int, Path(ge=1)],
    feature_name: Annotated[str, Path(min_length=1, max_length=512)],
    patch: FeatureRegistryEntryPatch,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FeatureRegistryEntryOut:
    ds = _owned_dataset(db, dataset_id, current_user)

    entry = (
        db.query(FeatureRegistryEntry)
        .filter(
            FeatureRegistryEntry.user_id == current_user.id,
            FeatureRegistryEntry.dataset_id == dataset_id,
            FeatureRegistryEntry.feature_name == feature_name,
        )
        .first()
    )
    if entry is None:
        entry = FeatureRegistryEntry(
            user_id=current_user.id,
            dataset_id=dataset_id,
            feature_name=feature_name,
        )
        db.add(entry)

    if patch.owner is not None:
        entry.owner = patch.owner.strip() or None
    if patch.business_definition is not None:
        entry.business_definition = patch.business_definition.strip() or None
    if patch.allowed_use is not None:
        entry.allowed_use = patch.allowed_use.strip() or None
    if patch.notes is not None:
        entry.notes = patch.notes.strip() or None
    if patch.mark_reviewed:
        entry.last_reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(entry)

    in_dataset = feature_name in _dataset_columns(ds)
    return _entry_to_out(entry, in_dataset=in_dataset)
