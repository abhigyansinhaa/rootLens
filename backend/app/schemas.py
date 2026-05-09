from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ColumnSchema(BaseModel):
    name: str
    dtype: str
    null_ratio: float
    n_unique: int
    sample_values: list[str] = []


class DatasetOut(BaseModel):
    id: int
    name: str
    filename: str
    file_format: str
    rows: int
    cols: int
    columns: list[ColumnSchema]
    created_at: datetime

    model_config = {"from_attributes": True}


class DatasetCreateResponse(DatasetOut):
    pass


class AnalysisCreate(BaseModel):
    target: str
    test_size: float = Field(default=0.2, ge=0.05, le=0.5)
    max_rows: int | None = Field(default=None, description="Optional cap on rows used for training")
    value_column: str | None = Field(default=None, description="Optional numeric column for revenue / value KPIs")
    datetime_column: str | None = Field(
        default=None,
        description="Optional datetime column for chronological ordering and walk-forward CV",
    )


class AnalysisOut(BaseModel):
    id: int
    dataset_id: int
    target: str
    datetime_column: str | None = None
    value_column: str | None = None
    task_type: str | None
    status: str
    metrics: dict[str, Any] | None = None
    model_metadata: dict[str, Any] | None = None
    insights: list[dict[str, Any]] | None = None
    recommendations: list[str] | None = None
    feature_importance: list[dict[str, Any]] | None = None
    shap_summary: list[dict[str, Any]] | None = None
    shap_summary_image_url: str | None = None
    report: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class AnalysisListItem(BaseModel):
    id: int
    dataset_id: int
    dataset_name: str
    target: str
    datetime_column: str | None = None
    task_type: str | None = None
    status: str
    value_column: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    kpi_summary: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class ColumnSchemaJson(BaseModel):
    """Stored in DB as JSON string."""

    columns: list[ColumnSchema]


class DatasetProfileRequest(BaseModel):
    target: str


class DatasetProfileOut(BaseModel):
    ok: bool
    blocking_errors: list[str]
    warnings: list[str]
    dataset_health: dict[str, Any]
    target_suitability: dict[str, Any]
    task_type_hint: str | None = None
