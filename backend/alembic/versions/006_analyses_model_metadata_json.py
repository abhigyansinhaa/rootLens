"""Add analyses.model_metadata_json when missing (legacy DBs).

Revision ID: 006_model_meta
Revises: 005_core_cols
Create Date: 2026-05-15

Older ``analyses`` tables predating current ``001_initial`` lack ``model_metadata_json``.
``005_core_cols`` did not add it; ``stamp head`` left Alembic at head without this column.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_model_meta"
down_revision: Union[str, Sequence[str], None] = "005_core_cols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table: str) -> set[str]:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return {str(c["name"]) for c in insp.get_columns(table)}


def upgrade() -> None:
    if "model_metadata_json" not in _column_names("analyses"):
        with op.batch_alter_table("analyses") as batch_op:
            batch_op.add_column(sa.Column("model_metadata_json", sa.Text(), nullable=True))


def downgrade() -> None:
    if "model_metadata_json" in _column_names("analyses"):
        with op.batch_alter_table("analyses") as batch_op:
            batch_op.drop_column("model_metadata_json")
