"""Per-analysis artifact manifest (``artifacts.json``) — canonical location.

Lists every file we ship under ``data/artifacts/{analysis_id}/`` with its
sha256 and the `pipeline_version` that produced it. The manifest itself is just
another JSON artifact served through the existing
``/analyses/{id}/artifacts/{filename}`` endpoint — no new transport layer.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


def _sha256_file(path: Path, *, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def write_artifact_manifest(
    artifact_dir: Path,
    *,
    pipeline_version: str,
    encoder_version: str,
    analysis_id: int,
    dataset_hash: str | None = None,
) -> Path | None:
    """Scan ``artifact_dir`` and write ``artifacts.json``. Returns the path or None on failure."""
    try:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        entries = []
        for p in sorted(artifact_dir.iterdir()):
            if not p.is_file() or p.name == "artifacts.json":
                continue
            try:
                entries.append(
                    {
                        "filename": p.name,
                        "size_bytes": int(p.stat().st_size),
                        "sha256": _sha256_file(p),
                    }
                )
            except Exception as e:
                logger.warning("Skipping artifact %s in manifest: %s", p, e)

        manifest = {
            "analysis_id": int(analysis_id),
            "pipeline_version": pipeline_version,
            "encoder_version": encoder_version,
            "dataset_hash": dataset_hash,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "artifacts": entries,
        }
        out = artifact_dir / "artifacts.json"
        out.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
        return out
    except Exception as e:
        logger.warning("Artifact manifest write failed: %s", e)
        return None
