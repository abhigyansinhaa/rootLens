"""Tests for GET /api/datasets/{dataset_id}/analyses scoping."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.deps import get_current_user
from app.main import app
from app.models import Analysis, Dataset, User
from tests.migration_utils import alembic_upgrade_head


@pytest.fixture
def client_and_db(tmp_path):
    db_file = tmp_path / "dataset_analyses_route.db"
    url = f"sqlite:///{db_file.as_posix()}"
    alembic_upgrade_head(url)
    engine = create_engine(url, connect_args={"check_same_thread": False})
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db = TestSession()
    user = User(email="a@example.com", password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    def override_get_db():
        s = TestSession()
        try:
            yield s
        finally:
            s.close()

    def override_user():
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        yield TestClient(app), db, user
    finally:
        db.close()
        app.dependency_overrides.clear()
        engine.dispose()


def _make_dataset(db, user_id: int, name: str) -> Dataset:
    ds = Dataset(
        user_id=user_id,
        name=name,
        filename=f"{name}.csv",
        storage_path=f"/tmp/{name}.csv",
        file_format="csv",
        rows=10,
        cols=2,
        columns_json=json.dumps([
            {"name": "x", "dtype": "float64", "null_ratio": 0.0, "n_unique": 10, "sample_values": []},
            {"name": "y", "dtype": "int64", "null_ratio": 0.0, "n_unique": 2, "sample_values": []},
        ]),
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds


def _make_analysis(db, dataset_id: int, target: str = "y", status: str = "completed") -> Analysis:
    a = Analysis(dataset_id=dataset_id, target=target, status=status)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def test_dataset_scoped_route_only_returns_matching_dataset(client_and_db):
    client, db, user = client_and_db

    ds_a = _make_dataset(db, user.id, "alpha")
    ds_b = _make_dataset(db, user.id, "beta")
    a1 = _make_analysis(db, ds_a.id, target="t1")
    a2 = _make_analysis(db, ds_a.id, target="t2", status="queued")
    _ = _make_analysis(db, ds_b.id, target="t3")

    r = client.get(f"/api/datasets/{ds_a.id}/analyses")
    assert r.status_code == 200, r.text
    rows = r.json()
    ids = {row["id"] for row in rows}
    assert ids == {a1.id, a2.id}
    for row in rows:
        assert row["dataset_id"] == ds_a.id
        assert row["dataset_name"] == "alpha"


def test_dataset_scoped_route_404_when_dataset_missing(client_and_db):
    client, _db, _user = client_and_db
    r = client.get("/api/datasets/9999/analyses")
    assert r.status_code == 404
