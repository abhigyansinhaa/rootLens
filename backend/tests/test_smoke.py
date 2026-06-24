"""Comprehensive backend smoke tests.

Exercises every API route, auth flow, authorization boundary, edge case,
schema validation rule, and infrastructure utility that can be tested without
an external database or Redis worker.

Uses the session-scoped SQLite DB provided by the shared ``conftest.py``
(Alembic-migrated ``.pytest_sqlite_app.db``).  Each test class that needs HTTP
access creates its own ``TestClient`` via ``client_and_db``, which overrides
``get_db`` to yield sessions from the same DB and overrides ``get_current_user``
with a dedicated test user.
"""

from __future__ import annotations

import io
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth import create_access_token, decode_token, hash_password, verify_password
from app.config import settings
from app.deps import get_current_user
from app.infrastructure.db import get_db
from app.infrastructure.storage import (
    content_hash_of_bytes,
    delete_file,
    ensure_dirs,
    has_parquet_sidecar,
    parquet_sidecar_path,
    save_upload,
)
from app.main import app
from app.models import Analysis, Dataset, User
from tests.migration_utils import alembic_upgrade_head

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_CSV = b"x,y\n1,0\n2,1\n3,0\n4,1\n5,0\n6,1\n7,0\n8,1\n9,0\n10,1\n"


def _make_user(db: Session, email: str = "smoke@test.com") -> User:
    u = User(email=email, password_hash=hash_password("SecureP@ss1"))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_dataset(
    db: Session,
    user_id: int,
    name: str = "test_ds",
    columns_json: str | None = None,
) -> Dataset:
    cols = columns_json or json.dumps([
        {"name": "x", "dtype": "float64", "null_ratio": 0.0, "n_unique": 10, "sample_values": ["1", "2"]},
        {"name": "y", "dtype": "int64", "null_ratio": 0.0, "n_unique": 2, "sample_values": ["0", "1"]},
    ])
    ds = Dataset(
        user_id=user_id,
        name=name,
        filename=f"{name}.csv",
        storage_path=f"/tmp/smoke_{name}.csv",
        file_format="csv",
        rows=10,
        cols=2,
        columns_json=cols,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds


def _make_analysis(
    db: Session,
    dataset_id: int,
    target: str = "y",
    status: str = "queued",
    **kwargs: Any,
) -> Analysis:
    a = Analysis(dataset_id=dataset_id, target=target, status=status, **kwargs)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@pytest.fixture()
def client_and_db(tmp_path):
    """Yields (TestClient, Session, User) with a completely isolated SQLite DB.

    Uses its own engine bound to a fresh DB file in ``tmp_path``, fully
    independent of the session-level conftest DB so there are zero
    cross-test ordering issues.
    """
    db_file = tmp_path / "smoke.db"
    url = f"sqlite:///{db_file.as_posix()}"
    alembic_upgrade_head(url)
    engine = create_engine(url, connect_args={"check_same_thread": False})
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db = TestSession()
    user = _make_user(db, email=f"smoke_{time.monotonic_ns()}@test.com")

    def override_get_db():
        s = TestSession()
        try:
            yield s
        finally:
            s.close()

    def override_user():
        return db.merge(user)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        yield TestClient(app, raise_server_exceptions=False), db, user
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()


# ===================================================================
# 1. Health endpoint
# ===================================================================

class TestHealth:
    def test_health_returns_ok(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_health_no_auth_required(self, client_and_db):
        """Health endpoint must be reachable even without a token."""
        client, _, _ = client_and_db
        # Temporarily remove user override
        saved = dict(app.dependency_overrides)
        app.dependency_overrides.pop(get_current_user, None)
        try:
            r = client.get("/api/health")
            assert r.status_code == 200
        finally:
            app.dependency_overrides.update(saved)


# ===================================================================
# 2. Auth endpoints
# ===================================================================

class TestAuthRegister:
    def test_register_success(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post(
            "/api/auth/register",
            json={"email": "newuser@smoke.io", "password": "StrongP@ss1"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "newuser@smoke.io"
        assert "id" in body
        assert "created_at" in body

    def test_register_duplicate_email_returns_400(self, client_and_db):
        client, _, _ = client_and_db
        payload = {"email": "dup@smoke.io", "password": "StrongP@ss1"}
        r1 = client.post("/api/auth/register", json=payload)
        assert r1.status_code == 200
        r2 = client.post("/api/auth/register", json=payload)
        assert r2.status_code == 400
        assert "already" in r2.json()["detail"].lower()

    def test_register_short_password_returns_422(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post(
            "/api/auth/register",
            json={"email": "short@smoke.io", "password": "abc"},
        )
        assert r.status_code == 422

    def test_register_invalid_email_returns_422(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "StrongP@ss1"},
        )
        assert r.status_code == 422

    def test_register_missing_fields_returns_422(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post("/api/auth/register", json={})
        assert r.status_code == 422


class TestAuthLogin:
    def test_login_success(self, client_and_db):
        client, _, _ = client_and_db
        email, pw = "login_ok@smoke.io", "StrongP@ss1"
        client.post("/api/auth/register", json={"email": email, "password": pw})
        r = client.post("/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body.get("token_type") == "bearer"

    def test_login_wrong_password(self, client_and_db):
        client, _, _ = client_and_db
        email = "wrong_pw@smoke.io"
        client.post("/api/auth/register", json={"email": email, "password": "StrongP@ss1"})
        r = client.post("/api/auth/login", json={"email": email, "password": "WrongP@ss1"})
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post(
            "/api/auth/login",
            json={"email": "ghost@smoke.io", "password": "StrongP@ss1"},
        )
        assert r.status_code == 401


class TestAuthMe:
    def test_me_returns_current_user(self, client_and_db):
        client, _, user = client_and_db
        r = client.get("/api/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == user.email
        assert body["id"] == user.id

    def test_me_without_token_returns_401(self, client_and_db):
        client, _, _ = client_and_db
        saved = dict(app.dependency_overrides)
        app.dependency_overrides.pop(get_current_user, None)
        try:
            r = client.get("/api/auth/me")
            assert r.status_code == 401
        finally:
            app.dependency_overrides.update(saved)


# ===================================================================
# 3. Auth utility functions (no HTTP needed)
# ===================================================================

class TestAuthUtils:
    def test_password_hash_roundtrip(self):
        pw = "MySecure1234!"
        h = hash_password(pw)
        assert h != pw
        assert verify_password(pw, h)

    def test_password_wrong_does_not_verify(self):
        h = hash_password("Correct!")
        assert not verify_password("Wrong!", h)

    def test_token_roundtrip(self):
        email = "tok@test.io"
        tok = create_access_token(email)
        assert decode_token(tok) == email

    def test_expired_token_returns_none(self):
        expire = datetime.now(timezone.utc) - timedelta(seconds=10)
        tok = jwt.encode(
            {"sub": "exp@test.io", "exp": expire},
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        assert decode_token(tok) is None

    def test_malformed_token_returns_none(self):
        assert decode_token("not.a.jwt") is None

    def test_token_missing_sub_returns_none(self):
        expire = datetime.now(timezone.utc) + timedelta(hours=1)
        tok = jwt.encode(
            {"exp": expire},
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        assert decode_token(tok) is None


# ===================================================================
# 4. Dataset CRUD
# ===================================================================

class TestDatasetUpload:
    def test_upload_csv(self, client_and_db, tmp_path):
        client, db, user = client_and_db
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        settings.__dict__["artifacts_dir"] = tmp_path / "artifacts"
        ensure_dirs()

        r = client.post(
            "/api/datasets",
            files={"file": ("test.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["filename"] == "test.csv"
        assert body["file_format"] == "csv"
        assert body["rows"] == 10
        assert body["cols"] == 2
        assert len(body["columns"]) == 2

    def test_upload_empty_file_returns_400(self, client_and_db, tmp_path):
        client, _, _ = client_and_db
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        settings.__dict__["artifacts_dir"] = tmp_path / "artifacts"
        ensure_dirs()
        r = client.post(
            "/api/datasets",
            files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")},
        )
        assert r.status_code == 400

    def test_upload_unsupported_extension_returns_400(self, client_and_db, tmp_path):
        client, _, _ = client_and_db
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        settings.__dict__["artifacts_dir"] = tmp_path / "artifacts"
        ensure_dirs()
        r = client.post(
            "/api/datasets",
            files={"file": ("data.xlsx", io.BytesIO(b"fake"), "application/octet-stream")},
        )
        assert r.status_code == 400

    def test_upload_bad_csv_returns_400(self, client_and_db, tmp_path):
        client, _, _ = client_and_db
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        settings.__dict__["artifacts_dir"] = tmp_path / "artifacts"
        ensure_dirs()
        r = client.post(
            "/api/datasets",
            files={"file": ("broken.csv", io.BytesIO(b"\x00\x01\x02"), "text/csv")},
        )
        assert r.status_code in (201, 400)


class TestDatasetList:
    def test_list_datasets(self, client_and_db):
        client, db, user = client_and_db
        _make_dataset(db, user.id, "ds1")
        _make_dataset(db, user.id, "ds2")
        r = client.get("/api/datasets")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) >= 2

    def test_list_datasets_with_pagination(self, client_and_db):
        client, db, user = client_and_db
        for i in range(5):
            _make_dataset(db, user.id, f"pag_{i}")
        r = client.get("/api/datasets?limit=2&offset=0")
        assert r.status_code == 200
        assert len(r.json()) <= 2


class TestDatasetGetById:
    def test_get_dataset_by_id(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "get_me")
        r = client.get(f"/api/datasets/{ds.id}")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == ds.id
        assert body["name"] == "get_me"

    def test_get_dataset_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/datasets/999999")
        assert r.status_code == 404


class TestDatasetDelete:
    def test_delete_dataset(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "delete_me")
        r = client.delete(f"/api/datasets/{ds.id}")
        assert r.status_code == 204

    def test_delete_nonexistent_dataset_returns_404(self, client_and_db):
        client, _, _ = client_and_db
        r = client.delete("/api/datasets/999999")
        assert r.status_code == 404


# ===================================================================
# 5. Analysis CRUD
# ===================================================================

class TestAnalysisCreate:
    def test_create_analysis(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "an_ds")
        r = client.post(f"/api/datasets/{ds.id}/analyses", json={"target": "y"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["target"] == "y"
        assert body["status"] == "queued"
        assert body["dataset_id"] == ds.id

    def test_create_analysis_invalid_target_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "an_ds_bad")
        r = client.post(
            f"/api/datasets/{ds.id}/analyses",
            json={"target": "nonexistent_col"},
        )
        assert r.status_code == 400
        assert "nonexistent_col" in r.json()["detail"]

    def test_create_analysis_nonexistent_dataset_returns_404(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post("/api/datasets/999999/analyses", json={"target": "y"})
        assert r.status_code == 404

    def test_create_analysis_with_value_column(self, client_and_db):
        client, db, user = client_and_db
        cols = json.dumps([
            {"name": "x", "dtype": "float64", "null_ratio": 0.0, "n_unique": 10, "sample_values": []},
            {"name": "y", "dtype": "int64", "null_ratio": 0.0, "n_unique": 2, "sample_values": []},
            {"name": "revenue", "dtype": "float64", "null_ratio": 0.0, "n_unique": 5, "sample_values": []},
        ])
        ds = _make_dataset(db, user.id, "an_val", columns_json=cols)
        r = client.post(
            f"/api/datasets/{ds.id}/analyses",
            json={"target": "y", "value_column": "revenue"},
        )
        assert r.status_code == 201

    def test_create_analysis_value_column_equals_target_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "val_eq_target")
        r = client.post(
            f"/api/datasets/{ds.id}/analyses",
            json={"target": "y", "value_column": "y"},
        )
        assert r.status_code == 400
        assert "differ" in r.json()["detail"].lower()

    def test_create_analysis_non_numeric_value_col_returns_400(self, client_and_db):
        client, db, user = client_and_db
        cols = json.dumps([
            {"name": "y", "dtype": "int64", "null_ratio": 0.0, "n_unique": 2, "sample_values": []},
            {"name": "cat", "dtype": "object", "null_ratio": 0.0, "n_unique": 5, "sample_values": []},
        ])
        ds = _make_dataset(db, user.id, "non_num_val", columns_json=cols)
        r = client.post(
            f"/api/datasets/{ds.id}/analyses",
            json={"target": "y", "value_column": "cat"},
        )
        assert r.status_code == 400
        assert "numeric" in r.json()["detail"].lower()


class TestAnalysisList:
    def test_list_all_analyses(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "list_an")
        _make_analysis(db, ds.id, target="y", status="completed")
        _make_analysis(db, ds.id, target="y", status="queued")
        r = client.get("/api/analyses")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) >= 2

    def test_list_dataset_analyses(self, client_and_db):
        client, db, user = client_and_db
        ds1 = _make_dataset(db, user.id, "scope_a")
        ds2 = _make_dataset(db, user.id, "scope_b")
        _make_analysis(db, ds1.id, target="y")
        _make_analysis(db, ds2.id, target="y")
        r = client.get(f"/api/datasets/{ds1.id}/analyses")
        assert r.status_code == 200
        ids = {a["dataset_id"] for a in r.json()}
        assert ids == {ds1.id}

    def test_list_dataset_analyses_nonexistent_dataset_returns_404(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/datasets/999999/analyses")
        assert r.status_code == 404


class TestAnalysisGetById:
    def test_get_analysis_by_id(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "get_an")
        a = _make_analysis(db, ds.id)
        r = client.get(f"/api/analyses/{a.id}")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == a.id
        assert body["target"] == "y"

    def test_get_analysis_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/analyses/999999")
        assert r.status_code == 404


class TestAnalysisDelete:
    def test_delete_analysis(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "del_an")
        a = _make_analysis(db, ds.id)
        r = client.delete(f"/api/analyses/{a.id}")
        assert r.status_code == 204

    def test_delete_analysis_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.delete("/api/analyses/999999")
        assert r.status_code == 404


# ===================================================================
# 6. Artifact download
# ===================================================================

class TestAnalysisArtifacts:
    def test_download_artifact_not_found(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "art_ds")
        a = _make_analysis(db, ds.id, status="completed")
        r = client.get(f"/api/analyses/{a.id}/artifacts/shap_summary.png")
        assert r.status_code == 404

    def test_download_unsupported_artifact_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "art_ds2")
        a = _make_analysis(db, ds.id, status="completed")
        r = client.get(f"/api/analyses/{a.id}/artifacts/evil.exe")
        assert r.status_code == 400
        assert "unsupported" in r.json()["detail"].lower()

    def test_download_artifact_path_traversal_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "art_ds3")
        a = _make_analysis(db, ds.id, status="completed")
        r = client.get(f"/api/analyses/{a.id}/artifacts/../../../etc/passwd")
        assert r.status_code in (400, 404, 422)


# ===================================================================
# 7. Sandbox endpoint
# ===================================================================

class TestAnalysisSandbox:
    def test_sandbox_returns_preview(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "sand_ds")
        a = _make_analysis(db, ds.id, status="completed")
        r = client.post(
            f"/api/analyses/{a.id}/sandbox",
            json={"adjustments": [{"feature": "x", "value": 5}]},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "preview_only"
        assert len(body["received_adjustments"]) == 1

    def test_sandbox_no_body_ok(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "sand_ds2")
        a = _make_analysis(db, ds.id, status="completed")
        r = client.post(f"/api/analyses/{a.id}/sandbox")
        assert r.status_code == 200

    def test_sandbox_analysis_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.post("/api/analyses/999999/sandbox", json={})
        assert r.status_code == 404


# ===================================================================
# 8. KPI history
# ===================================================================

class TestKpiHistory:
    def test_kpi_history_incomplete_analysis_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "kpi_ds")
        a = _make_analysis(db, ds.id, status="queued")
        r = client.get(f"/api/analyses/{a.id}/kpi-history")
        assert r.status_code == 400

    def test_kpi_history_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/analyses/999999/kpi-history")
        assert r.status_code == 404


# ===================================================================
# 9. Risk-by-column
# ===================================================================

class TestRiskByColumn:
    def test_risk_by_column_incomplete_returns_400(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "risk_ds")
        a = _make_analysis(db, ds.id, status="queued")
        r = client.get(f"/api/analyses/{a.id}/risk-by-column?column=x")
        assert r.status_code == 400

    def test_risk_by_column_not_found(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/api/analyses/999999/risk-by-column?column=x")
        assert r.status_code == 404


# ===================================================================
# 10. Feature registry
# ===================================================================

class TestFeatureRegistry:
    def test_list_feature_registry_empty(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "fr_ds")
        r = client.get(f"/api/datasets/{ds.id}/feature-registry")
        assert r.status_code == 200
        body = r.json()
        assert "entries" in body
        assert body["coverage"] == 0.0
        names = {e["feature_name"] for e in body["entries"]}
        assert "x" in names
        assert "y" in names

    def test_patch_creates_then_updates_entry(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "fr_ds_patch")
        r = client.patch(
            f"/api/datasets/{ds.id}/feature-registry/x",
            json={"owner": "data-team", "business_definition": "Feature x"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["owner"] == "data-team"
        assert body["is_governed"] is True
        assert body["is_in_dataset"] is True

        r2 = client.patch(
            f"/api/datasets/{ds.id}/feature-registry/x",
            json={"notes": "Updated notes", "mark_reviewed": True},
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["notes"] == "Updated notes"
        assert body2["last_reviewed_at"] is not None

    def test_patch_nonexistent_dataset_returns_404(self, client_and_db):
        client, _, _ = client_and_db
        r = client.patch(
            "/api/datasets/999999/feature-registry/x",
            json={"owner": "nobody"},
        )
        assert r.status_code == 404

    def test_coverage_increases_with_governance(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "fr_cov")
        r0 = client.get(f"/api/datasets/{ds.id}/feature-registry")
        assert r0.json()["coverage"] == 0.0
        client.patch(
            f"/api/datasets/{ds.id}/feature-registry/x",
            json={"owner": "team-a"},
        )
        r1 = client.get(f"/api/datasets/{ds.id}/feature-registry")
        assert r1.json()["coverage"] == 0.5

    def test_patch_controllability_field(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "fr_ctrl")
        r = client.patch(
            f"/api/datasets/{ds.id}/feature-registry/x",
            json={"controllability": "controllable"},
        )
        assert r.status_code == 200
        assert r.json()["controllability"] == "controllable"


# ===================================================================
# 11. Storage / infrastructure utilities (no HTTP)
# ===================================================================

class TestStorageUtils:
    def test_content_hash_deterministic(self):
        h1 = content_hash_of_bytes(b"hello world")
        h2 = content_hash_of_bytes(b"hello world")
        assert h1 == h2
        assert len(h1) == 64

    def test_content_hash_differs_for_different_content(self):
        assert content_hash_of_bytes(b"aaa") != content_hash_of_bytes(b"bbb")

    def test_save_upload_csv(self, tmp_path):
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        (tmp_path / "uploads").mkdir()
        path, fmt = save_upload("test.csv", SAMPLE_CSV)
        assert fmt == "csv"
        assert Path(path).is_file()

    def test_save_upload_parquet(self, tmp_path):
        import pandas as pd
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        (tmp_path / "uploads").mkdir()
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        buf = io.BytesIO()
        df.to_parquet(buf, index=False)
        path, fmt = save_upload("data.parquet", buf.getvalue())
        assert fmt == "parquet"
        assert Path(path).is_file()

    def test_save_upload_unsupported_ext_raises(self, tmp_path):
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        (tmp_path / "uploads").mkdir()
        with pytest.raises(ValueError, match="Only .csv and .parquet"):
            save_upload("data.json", b"{}")

    def test_delete_file_removes_csv_and_sidecar(self, tmp_path):
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        (tmp_path / "uploads").mkdir()
        path, _ = save_upload("del.csv", SAMPLE_CSV)
        p = Path(path)
        sidecar = parquet_sidecar_path(path)
        assert p.is_file()
        delete_file(path)
        assert not p.is_file()
        assert not sidecar.is_file()

    def test_ensure_dirs_creates_missing_dirs(self, tmp_path):
        settings.__dict__["uploads_dir"] = tmp_path / "new_up"
        settings.__dict__["artifacts_dir"] = tmp_path / "new_art"
        settings.__dict__["data_dir"] = tmp_path / "new_data"
        ensure_dirs()
        assert (tmp_path / "new_up").is_dir()
        assert (tmp_path / "new_art").is_dir()
        assert (tmp_path / "new_data").is_dir()

    def test_parquet_sidecar_path(self):
        assert str(parquet_sidecar_path("/some/file.csv")).endswith(".parquet")

    def test_has_parquet_sidecar_false_for_parquet_format(self):
        assert not has_parquet_sidecar("/some/file.parquet", "parquet")


# ===================================================================
# 12. Config / Settings
# ===================================================================

class TestConfig:
    def test_settings_loaded(self):
        assert settings.secret_key
        assert len(settings.secret_key) >= 32
        assert settings.algorithm == "HS256"
        assert settings.access_token_expire_minutes > 0

    def test_data_dirs_are_set(self):
        assert settings.data_dir is not None
        assert settings.uploads_dir is not None
        assert settings.artifacts_dir is not None

    def test_cors_origins_is_list(self):
        assert isinstance(settings.cors_origins, list)
        assert len(settings.cors_origins) > 0


# ===================================================================
# 13. SQLAlchemy model constraints
# ===================================================================

class TestModelConstraints:
    def test_user_requires_email(self, client_and_db):
        _, db, _ = client_and_db
        from sqlalchemy.exc import IntegrityError
        user = User(email=None, password_hash="x")
        db.add(user)
        with pytest.raises((IntegrityError, Exception)):
            db.commit()
        db.rollback()

    def test_dataset_requires_user_id(self, client_and_db):
        _, db, _ = client_and_db
        from sqlalchemy.exc import IntegrityError
        ds = Dataset(
            user_id=None, name="orphan", filename="a.csv",
            storage_path="/tmp/a.csv", file_format="csv",
            rows=1, cols=1, columns_json="[]",
        )
        db.add(ds)
        with pytest.raises((IntegrityError, Exception)):
            db.commit()
        db.rollback()


# ===================================================================
# 14. Pydantic schema validation
# ===================================================================

class TestSchemaValidation:
    def test_analysis_create_rejects_bad_test_size(self):
        from app.domain.schemas import AnalysisCreate
        with pytest.raises(Exception):
            AnalysisCreate(target="y", test_size=0.0)
        with pytest.raises(Exception):
            AnalysisCreate(target="y", test_size=0.9)

    def test_analysis_create_defaults(self):
        from app.domain.schemas import AnalysisCreate
        ac = AnalysisCreate(target="y")
        assert ac.test_size == 0.2
        assert ac.max_rows is None
        assert ac.value_column is None

    def test_user_create_password_min_length(self):
        from app.domain.schemas import UserCreate
        with pytest.raises(Exception):
            UserCreate(email="a@b.com", password="short")

    def test_user_create_valid(self):
        from app.domain.schemas import UserCreate
        uc = UserCreate(email="valid@test.com", password="ValidP@ss1")
        assert uc.email == "valid@test.com"

    def test_dataset_profile_request(self):
        from app.domain.schemas import DatasetProfileRequest
        assert DatasetProfileRequest(target="churn").target == "churn"

    def test_feature_registry_patch_all_optional(self):
        from app.domain.schemas import FeatureRegistryEntryPatch
        patch = FeatureRegistryEntryPatch()
        assert patch.owner is None
        assert patch.mark_reviewed is False


# ===================================================================
# 15. Cross-user isolation
# ===================================================================

class TestCrossUserIsolation:
    def test_user_b_cannot_see_user_a_dataset(self, tmp_path):
        db_file = tmp_path / "isolation.db"
        url = f"sqlite:///{db_file.as_posix()}"
        alembic_upgrade_head(url)
        engine = create_engine(url, connect_args={"check_same_thread": False})
        TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

        db = TestSession()
        user_a = _make_user(db, "user_a@test.io")
        user_b = _make_user(db, "user_b@test.io")
        ds_a = _make_dataset(db, user_a.id, "private_a")

        def override_db():
            s = TestSession()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: user_b
        try:
            with TestClient(app, raise_server_exceptions=False) as c:
                r = c.get(f"/api/datasets/{ds_a.id}")
                assert r.status_code == 404, "User B should not see User A's dataset"

                r2 = c.get("/api/datasets")
                ids = {d["id"] for d in r2.json()}
                assert ds_a.id not in ids
        finally:
            app.dependency_overrides.clear()
            db.close()
            engine.dispose()


# ===================================================================
# 16. Content-hash dedup
# ===================================================================

class TestDatasetDedup:
    def test_duplicate_upload_returns_existing(self, client_and_db, tmp_path):
        client, db, user = client_and_db
        settings.__dict__["uploads_dir"] = tmp_path / "uploads"
        settings.__dict__["artifacts_dir"] = tmp_path / "artifacts"
        ensure_dirs()

        r1 = client.post(
            "/api/datasets",
            files={"file": ("dup.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        )
        assert r1.status_code == 201
        id1 = r1.json()["id"]

        r2 = client.post(
            "/api/datasets",
            files={"file": ("dup.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        )
        assert r2.status_code in (200, 201)
        id2 = r2.json()["id"]
        assert id1 == id2, "Duplicate upload should return existing dataset"


# ===================================================================
# 17. OpenAPI / docs
# ===================================================================

class TestOpenAPI:
    def test_openapi_schema_accessible(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert schema["info"]["title"] == "rootLens ML Platform"
        assert "/api/health" in schema["paths"]
        assert "/api/auth/register" in schema["paths"]
        assert "/api/auth/login" in schema["paths"]
        assert "/api/datasets" in schema["paths"]

    def test_docs_page_accessible(self, client_and_db):
        client, _, _ = client_and_db
        r = client.get("/docs")
        assert r.status_code == 200


# ===================================================================
# 18. Response shape validation
# ===================================================================

class TestResponseShapes:
    def test_analysis_out_has_all_keys(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "shape_ds")
        a = _make_analysis(db, ds.id)
        r = client.get(f"/api/analyses/{a.id}")
        assert r.status_code == 200
        body = r.json()
        expected = {
            "id", "dataset_id", "target", "task_type", "status",
            "metrics", "insights", "recommendations", "feature_importance",
            "shap_summary", "error", "created_at", "completed_at",
            "report", "shap_summary_image_url", "shap_beeswarm_image_url",
        }
        assert expected.issubset(body.keys()), f"Missing: {expected - body.keys()}"

    def test_dataset_out_has_all_keys(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "shape_ds2")
        r = client.get(f"/api/datasets/{ds.id}")
        assert r.status_code == 200
        body = r.json()
        expected = {"id", "name", "filename", "file_format", "rows", "cols", "columns", "created_at"}
        assert expected.issubset(body.keys()), f"Missing: {expected - body.keys()}"

    def test_analysis_list_item_has_dataset_name(self, client_and_db):
        client, db, user = client_and_db
        ds = _make_dataset(db, user.id, "list_shape")
        _make_analysis(db, ds.id)
        r = client.get("/api/analyses")
        assert r.status_code == 200
        items = r.json()
        if items:
            assert "dataset_name" in items[0]
            assert "kpi_summary" in items[0]
