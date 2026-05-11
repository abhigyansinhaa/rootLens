"""dataset content hash + analysis versioning

Revision ID: 002_dataset_hash
Revises: 001_initial
Create Date: 2026-05-11

Adds:
* `datasets.content_hash` (sha256 of upload bytes) + per-user unique index.
* `analyses.pipeline_version` / `encoder_version` / `schema_hash` / `dataset_hash`
  to attribute results to the exact code path that produced them.
* `analyses.failed_reason` (short tag like "oom") populated by the worker on
  controlled failures so the UI can show a tailored message.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_dataset_hash"
down_revision: Union[str, Sequence[str], None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("datasets") as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(length=64), nullable=True))
    op.create_index(
        op.f("ix_datasets_content_hash"),
        "datasets",
        ["content_hash"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_datasets_user_content_hash",
        "datasets",
        ["user_id", "content_hash"],
    )

    with op.batch_alter_table("analyses") as batch_op:
        batch_op.add_column(sa.Column("pipeline_version", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("encoder_version", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("schema_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("dataset_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("failed_reason", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("analyses") as batch_op:
        batch_op.drop_column("failed_reason")
        batch_op.drop_column("dataset_hash")
        batch_op.drop_column("schema_hash")
        batch_op.drop_column("encoder_version")
        batch_op.drop_column("pipeline_version")

    op.drop_constraint("uq_datasets_user_content_hash", "datasets", type_="unique")
    op.drop_index(op.f("ix_datasets_content_hash"), table_name="datasets")
    with op.batch_alter_table("datasets") as batch_op:
        batch_op.drop_column("content_hash")
