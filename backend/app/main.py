import json
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import analyses, auth, datasets, feature_registry
from app.config import settings
from app.infrastructure.storage import ensure_dirs
from app.rate_limit import limiter


# ── Structured JSON logging ───────────────────────────────────────────────────

class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line — Railway logs become searchable by field."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts":     self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":  record.levelname,
            "logger": record.name,
            "msg":    record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def _configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(settings.log_level.upper())


_configure_logging()
logger = logging.getLogger(__name__)


# ── Startup validation ────────────────────────────────────────────────────────

def _validate_startup() -> None:
    """Fail fast with a clear message if required runtime config is missing.

    Surface problems immediately in Railway deploy logs rather than discovering
    them buried in a SQLAlchemy stack trace minutes later.
    """
    problems: list[str] = []

    if not settings.database_url:
        problems.append("DATABASE_URL is not set")

    if not settings.secret_key:
        problems.append("SECRET_KEY is not set")

    if settings.app_env == "production" and not settings.redis_url:
        problems.append(
            "REDIS_URL must be set in production — "
            "BackgroundTasks mode is not safe for production workloads"
        )

    if problems:
        msg = "Startup validation failed:\n" + "\n".join(f"  ✗ {p}" for p in problems)
        logger.critical(msg)
        raise RuntimeError(msg)

    logger.info(
        '{"msg":"Startup validation passed","env":"%s","redis":"%s","storage":"%s","cors_count":%d}',
        settings.app_env,
        "configured" if settings.redis_url else "disabled (BackgroundTasks)",
        settings.storage_backend,
        len(settings.cors_origins_parsed),
    )


# ── App lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_startup()
    ensure_dirs()
    if not settings.redis_url:
        logger.warning(
            "REDIS_URL is not set — analyses run in-process via BackgroundTasks. "
            "Jobs are lost if the API process crashes or the request scope ends unexpectedly; "
            "not suitable for production. Set REDIS_URL and run the RQ worker."
        )
    yield


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="rootLens ML Platform", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_parsed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(analyses.router, prefix="/api")
app.include_router(feature_registry.router, prefix="/api")


# ── Health & version endpoints ────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/version")
def version() -> dict[str, str]:
    """Returns build metadata — useful for confirming which deploy is live on Railway.

    RAILWAY_GIT_COMMIT_SHA and RAILWAY_GIT_COMMIT_TIMESTAMP are injected
    automatically by Railway at build time; no extra configuration required.
    """
    sha = os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown")
    return {
        "version": os.getenv("APP_VERSION", "dev"),
        "git_sha": sha[:8] if sha != "unknown" else "unknown",
        "env":     settings.app_env,
        "build":   os.getenv("RAILWAY_GIT_COMMIT_TIMESTAMP", "unknown"),
    }
