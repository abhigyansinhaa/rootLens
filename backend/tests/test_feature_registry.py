"""HTTP tests for the feature registry endpoints."""

from __future__ import annotations

import io
import uuid
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client: TestClient) -> str:
    email = f"reg_{uuid.uuid4().hex[:8]}@example.com"
    pw = "StrongPass!123"
    r = client.post("/api/auth/register", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


def _upload_dataset(client: TestClient, token: str) -> int:
    df = pd.DataFrame(
        {
            "tenure": [1, 2, 3, 4],
            "monthly_charges": [10.0, 20.0, 30.0, 40.0],
            "churn": [0, 1, 0, 1],
        }
    )
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    r = client.post(
        "/api/datasets",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("toy.csv", buf, "text/csv")},
        data={"name": "toy"},
    )
    assert r.status_code in (200, 201), r.text
    return int(r.json()["id"])


def test_feature_registry_lists_columns_and_upserts(tmp_path: Path):
    with TestClient(app) as client:
        token = _register_and_login(client)
        ds_id = _upload_dataset(client, token)
        h = {"Authorization": f"Bearer {token}"}

        r = client.get(f"/api/datasets/{ds_id}/feature-registry", headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["dataset_id"] == ds_id
        assert body["coverage"] == 0.0
        names = sorted(e["feature_name"] for e in body["entries"])
        assert names == ["churn", "monthly_charges", "tenure"]
        for entry in body["entries"]:
            assert entry["is_governed"] is False
            assert entry["is_in_dataset"] is True

        r = client.patch(
            f"/api/datasets/{ds_id}/feature-registry/tenure",
            headers=h,
            json={
                "owner": "growth-team",
                "business_definition": "Months since signup.",
                "allowed_use": "modeling-only",
                "mark_reviewed": True,
            },
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["feature_name"] == "tenure"
        assert out["owner"] == "growth-team"
        assert out["allowed_use"] == "modeling-only"
        assert out["is_governed"] is True
        assert out["is_in_dataset"] is True
        assert out["last_reviewed_at"] is not None

        r = client.get(f"/api/datasets/{ds_id}/feature-registry", headers=h)
        body = r.json()
        assert body["coverage"] == pytest.approx(1.0 / 3.0, abs=1e-9)
        tenure_entry = next(e for e in body["entries"] if e["feature_name"] == "tenure")
        assert tenure_entry["is_governed"] is True
        assert tenure_entry["business_definition"] == "Months since signup."


def test_feature_registry_rejects_other_users_dataset():
    with TestClient(app) as client:
        owner_token = _register_and_login(client)
        ds_id = _upload_dataset(client, owner_token)

        other_token = _register_and_login(client)
        r = client.get(
            f"/api/datasets/{ds_id}/feature-registry",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert r.status_code == 404
        r = client.patch(
            f"/api/datasets/{ds_id}/feature-registry/tenure",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"owner": "x"},
        )
        assert r.status_code == 404
