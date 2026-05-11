"""feature_registry table

Revision ID: 003_feature_registry
Revises: 002_dataset_hash
Create Date: 2026-05-11

Adds the per-(user, dataset, feature) governance table powering the GET / PATCH
``/api/datasets/{dataset_id}/feature-registry`` endpoints. This is NOT a
feature store — see ``app/domain/models.py::FeatureRegistryEntry``.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_feature_registry"
down_revision: Union[str, Sequence[str], None] = "002_dataset_hash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feature_registry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("feature_name", sa.String(length=512), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column("business_definition", sa.Text(), nullable=True),
        sa.Column("allowed_use", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "dataset_id",
            "feature_name",
            name="uq_feature_registry_user_dataset_feature",
        ),
    )
    op.create_index(
        op.f("ix_feature_registry_user_id"),
        "feature_registry",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_feature_registry_dataset_id"),
        "feature_registry",
        ["dataset_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_feature_registry_dataset_id"), table_name="feature_registry")
    op.drop_index(op.f("ix_feature_registry_user_id"), table_name="feature_registry")
    op.drop_table("feature_registry")
