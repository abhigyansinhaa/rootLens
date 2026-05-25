"""Smoke tests for the artifact manifest writer and JSONL audit logger."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.artifact_manifest import write_artifact_manifest


def test_write_artifact_manifest_lists_files_with_hashes(tmp_path: Path):
    art_dir = tmp_path / "42"
    art_dir.mkdir()
    f1 = art_dir / "shap_summary.png"
    f1.write_bytes(b"\x89PNG\r\n\x1a\nfake")
    f2 = art_dir / "predictions.parquet"
    f2.write_bytes(b"PAR1binary")
    (art_dir / "ignored_dir").mkdir()

    manifest_path = write_artifact_manifest(
        art_dir,
        pipeline_version="1.0",
        encoder_version="v2",
        analysis_id=42,
        dataset_hash="abc123",
    )
    assert manifest_path is not None and manifest_path.is_file()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert data["analysis_id"] == 42
    assert data["pipeline_version"] == "1.0"
    assert data["encoder_version"] == "v2"
    assert data["dataset_hash"] == "abc123"
    names = sorted(e["filename"] for e in data["artifacts"])
    assert names == ["predictions.parquet", "shap_summary.png"]
    for entry in data["artifacts"]:
        raw = (art_dir / entry["filename"]).read_bytes()
        assert entry["sha256"] == hashlib.sha256(raw).hexdigest()
        assert entry["size_bytes"] == len(raw)


def test_audit_logger_appends_one_line_per_event(tmp_path, monkeypatch):
    from app import audit_logger
    from app.config import settings

    monkeypatch.setattr(settings, "data_dir", tmp_path, raising=False)

    audit_logger.write_event("analysis.started", {"analysis_id": 1, "user_id": 5})
    audit_logger.write_event(
        "analysis.completed",
        {"analysis_id": 1, "user_id": 5, "status": "completed"},
    )

    audit_dir = tmp_path / "audit"
    files = list(audit_dir.glob("*.jsonl"))
    assert len(files) == 1, files
    lines = [json.loads(line) for line in files[0].read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 2
    assert {entry["event"] for entry in lines} == {"analysis.started", "analysis.completed"}
    assert lines[0]["analysis_id"] == 1
    assert "ts" in lines[1]
