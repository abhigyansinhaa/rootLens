import os
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "data"


# Resolved once at import time so SettingsConfigDict can use it.
_APP_ENV = os.getenv("APP_ENV", "development")

FORBIDDEN_SECRET_KEYS = frozenset(
    {
        "change-me-in-production-use-openssl-rand-hex-32",
        "dev-secret-change-me",
    }
)


class Settings(BaseSettings):
    # Base .env is loaded first; the environment-specific file overrides it.
    # E.g. APP_ENV=production → also loads .env.production (non-secrets only).
    model_config = SettingsConfigDict(
        env_file=(".env", f".env.{_APP_ENV}"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Environment profile ───────────────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    # ── Auth ──────────────────────────────────────────────────────────────────
    secret_key: str = Field(min_length=32, description="JWT signing secret from SECRET_KEY env")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = Field(description="SQLAlchemy URL, e.g. mysql+pymysql://user:pass@host:3306/db")

    # ── Storage ───────────────────────────────────────────────────────────────
    data_dir: Path = Field(default_factory=_default_data_dir)
    uploads_dir: Path | None = None
    artifacts_dir: Path | None = None
    storage_backend: Literal["local", "s3"] = Field(
        default="local",
        description="Storage driver: 'local' (Railway Volume) or 's3' (future R2/S3 sprint).",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Set CORS_ORIGINS as a comma-separated string in Railway Variables, e.g.:
    #   https://rootlens.ai,https://app.rootlens.ai
    #
    # Stored as a raw string so pydantic-settings doesn't try to JSON-decode it
    # from the env var. Parsed into a list by _parse_cors below.
    cors_origins: str = Field(
        default="http://localhost:5000,http://127.0.0.1:5000,http://localhost:8080,http://127.0.0.1:8080",
        description="Comma-separated allowed CORS origins (CORS_ORIGINS env var).",
    )
    # The parsed list — populated by the model_validator; not read from env.
    cors_origins_list: list[str] = Field(default_factory=list, exclude=True)

    # ── Redis / Worker ────────────────────────────────────────────────────────
    redis_url: str | None = Field(default=None)
    analysis_timeout_s: int = Field(
        default=1800,
        ge=60,
        le=24 * 60 * 60,
        description="Wall-clock budget for a single analysis job, in seconds (RQ job_timeout).",
    )

    # ── Validators ────────────────────────────────────────────────────────────

    @field_validator("database_url", mode="before")
    @classmethod
    def coerce_db_scheme(cls, v: str) -> str:
        """Railway MySQL add-on injects 'mysql://' — SQLAlchemy needs 'mysql+pymysql://'."""
        if isinstance(v, str) and v.startswith("mysql://"):
            return v.replace("mysql://", "mysql+pymysql://", 1)
        return v

    @field_validator("secret_key")
    @classmethod
    def reject_placeholder_secrets(cls, v: str) -> str:
        s = v.strip()
        if s in FORBIDDEN_SECRET_KEYS:
            raise ValueError(
                "SECRET_KEY must not use a placeholder value. Set a strong secret via environment or .env "
                "(see backend/.env.example)."
            )
        return v

    @model_validator(mode="after")
    def set_subdirs_and_parse_cors(self) -> "Settings":
        object.__setattr__(self, "uploads_dir", self.data_dir / "uploads")
        object.__setattr__(self, "artifacts_dir", self.data_dir / "artifacts")
        # Parse CORS_ORIGINS: supports both legacy JSON array and comma-separated format.
        raw = self.cors_origins.strip()
        if raw.startswith("["):
            import json
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = [o.strip().strip('"') for o in raw.strip("[]").split(",") if o.strip()]
        else:
            parsed = [o.strip() for o in raw.split(",") if o.strip()]
        object.__setattr__(self, "cors_origins_list", parsed)
        return self

    @property
    def cors_origins_parsed(self) -> list[str]:
        """Use this in FastAPI CORSMiddleware — it's the parsed list."""
        return self.cors_origins_list


settings = Settings()
