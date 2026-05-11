"""SQLAlchemy ORM models (canonical location).

`app.models` is a shim re-exporting from here.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    datasets: Mapped[list["Dataset"]] = relationship("Dataset", back_populates="owner")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_format: Mapped[str] = mapped_column(String(32), nullable=False)  # csv | parquet
    rows: Mapped[int] = mapped_column(Integer, nullable=False)
    cols: Mapped[int] = mapped_column(Integer, nullable=False)
    columns_json: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "content_hash", name="uq_datasets_user_content_hash"),
    )

    owner: Mapped["User"] = relationship("User", back_populates="datasets")
    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="dataset")


class FeatureRegistryEntry(Base):
    """Per-(user, dataset, feature) governance row.

    Not a feature store: there is no offline/online split, no shared
    distribution path, no transformation graph. It is a tiny annotation table
    that lets operators record ownership and intended use of dataset columns so
    governance can surface ungoverned features as warnings.
    """

    __tablename__ = "feature_registry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), nullable=False, index=True)
    feature_name: Mapped[str] = mapped_column(String(512), nullable=False)
    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_use: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "dataset_id",
            "feature_name",
            name="uq_feature_registry_user_dataset_feature",
        ),
    )


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(512), nullable=False)
    datetime_column: Mapped[str | None] = mapped_column(String(512), nullable=True)
    value_column: Mapped[str | None] = mapped_column(String(512), nullable=True)
    task_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # classification | regression
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    metrics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    insights_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    shap_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifacts_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    pipeline_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    encoder_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    schema_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dataset_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failed_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="analyses")
