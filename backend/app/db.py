"""Back-compat shim: canonical implementation lives at `app.infrastructure.db`."""

from app.infrastructure.db import Base, SessionLocal, engine, get_db  # noqa: F401

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
