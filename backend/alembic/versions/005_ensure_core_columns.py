"""Repair legacy MySQL schemas missing columns present in current ORM.

Revision ID: 005_core_cols
Revises: 004_featreg_ctrl
Create Date: 2026-05-12

Some databases were created from an older ``001_initial`` revision before
``analyses.datetime_column`` / ``value_column`` / ``task_type`` existed, while
``alembic_version`` still shows ``001_initial``. Later migrations then skip
DDL that would have created those columns.

This revision is idempotent: it only adds columns, indexes, and constraints
that are missing.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_core_cols"
down_revision: Union[str, Sequence[str], None] = "004_featreg_ctrl"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table: str) -> set[str]:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return {str(c["name"]) for c in insp.get_columns(table)}


def _index_names(table: str) -> set[str]:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return {str(ix["name"]) for ix in insp.get_indexes(table)}


def _unique_constraint_names(table: str) -> set[str]:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return {str(u["name"]) for u in insp.get_unique_constraints(table)}


def upgrade() -> None:
    dcols = _column_names("datasets")
    if "content_hash" not in dcols:
        with op.batch_alter_table("datasets") as batch_op:
            batch_op.add_column(sa.Column("content_hash", sa.String(length=64), nullable=True))

    idx = _index_names("datasets")
    if "ix_datasets_content_hash" not in idx:
        op.create_index(
            op.f("ix_datasets_content_hash"),
            "datasets",
            ["content_hash"],
            unique=False,
        )

    uq = _unique_constraint_names("datasets")
    if "uq_datasets_user_content_hash" not in uq:
        bind = op.get_bind()
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("datasets") as batch_op:
                batch_op.create_unique_constraint(
                    "uq_datasets_user_content_hash",
                    ["user_id", "content_hash"],
                )
        else:
            op.create_unique_constraint(
                "uq_datasets_user_content_hash",
                "datasets",
                ["user_id", "content_hash"],
            )

    acols = _column_names("analyses")
    analysis_adds: list[sa.Column] = []
    if "datetime_column" not in acols:
        analysis_adds.append(sa.Column("datetime_column", sa.String(length=512), nullable=True))
    if "value_column" not in acols:
        analysis_adds.append(sa.Column("value_column", sa.String(length=512), nullable=True))
    if "task_type" not in acols:
        analysis_adds.append(sa.Column("task_type", sa.String(length=32), nullable=True))
    if "pipeline_version" not in acols:
        analysis_adds.append(sa.Column("pipeline_version", sa.String(length=32), nullable=True))
    if "encoder_version" not in acols:
        analysis_adds.append(sa.Column("encoder_version", sa.String(length=32), nullable=True))
    if "schema_hash" not in acols:
        analysis_adds.append(sa.Column("schema_hash", sa.String(length=64), nullable=True))
    if "dataset_hash" not in acols:
        analysis_adds.append(sa.Column("dataset_hash", sa.String(length=64), nullable=True))
    if "failed_reason" not in acols:
        analysis_adds.append(sa.Column("failed_reason", sa.String(length=64), nullable=True))
    if analysis_adds:
        with op.batch_alter_table("analyses") as batch_op:
            for col in analysis_adds:
                batch_op.add_column(col)


def downgrade() -> None:
    """Repair migration is not safely reversible across mixed DB states."""
    pass
