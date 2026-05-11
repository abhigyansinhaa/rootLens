from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "data"


FORBIDDEN_SECRET_KEYS = frozenset(
    {
        "change-me-in-production-use-openssl-rand-hex-32",
        "dev-secret-change-me",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = Field(min_length=32, description="JWT signing secret from SECRET_KEY env")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = Field(description="SQLAlchemy URL, e.g. mysql+pymysql://user:pass@host:3306/db")
    data_dir: Path = Field(default_factory=_default_data_dir)
    uploads_dir: Path | None = None
    artifacts_dir: Path | None = None

    cors_origins: list[str] = [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    redis_url: str | None = Field(default=None)
    analysis_timeout_s: int = Field(
        default=1800,
        ge=60,
        le=24 * 60 * 60,
        description="Wall-clock budget for a single analysis job, in seconds (RQ job_timeout).",
    )

    @model_validator(mode="after")
    def set_subdirs(self) -> "Settings":
        object.__setattr__(self, "uploads_dir", self.data_dir / "uploads")
        object.__setattr__(self, "artifacts_dir", self.data_dir / "artifacts")
        return self

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


settings = Settings()
