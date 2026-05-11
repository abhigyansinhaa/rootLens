"""Back-compat shim: canonical implementation lives at `app.infrastructure.artifact_manifest`."""

from app.infrastructure.artifact_manifest import write_artifact_manifest  # noqa: F401

__all__ = ["write_artifact_manifest"]
