"""Back-compat shim: canonical implementation lives at `app.infrastructure.audit_logger`."""

from app.infrastructure.audit_logger import write_event  # noqa: F401

__all__ = ["write_event"]
