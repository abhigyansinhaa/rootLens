import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import analyses, auth, datasets, feature_registry
from app.config import settings
from app.infrastructure.storage import ensure_dirs
from app.rate_limit import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    if not settings.redis_url:
        logger.warning(
            "REDIS_URL is not set — analyses run in-process via BackgroundTasks. "
            "Jobs are lost if the API process crashes or the request scope ends unexpectedly; "
            "not suitable for production. Set REDIS_URL and run the RQ worker."
        )
    yield


app = FastAPI(title="RCA ML Platform", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(analyses.router, prefix="/api")
app.include_router(feature_registry.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
