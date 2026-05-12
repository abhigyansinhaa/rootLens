"""Add controllability to feature_registry

Revision ID: 004_featreg_ctrl
Revises: 003_feature_registry
Create Date: 2026-05-12

Note: revision id must fit ``alembic_version.version_num`` (often VARCHAR(32) on MySQL).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_featreg_ctrl"
down_revision: Union[str, Sequence[str], None] = "003_feature_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ensure_alembic_version_num_fits_long_ids() -> None:
    """Default MySQL Alembic table uses VARCHAR(32); widen so longer revision ids are safe."""
    bind = op.get_bind()
    if bind.dialect.name != "mysql":
        return
    op.execute(sa.text("ALTER TABLE alembic_version MODIFY COLUMN version_num VARCHAR(255) NOT NULL"))


def _feature_registry_columns() -> set[str]:
    """Column names on feature_registry (handles re-runs / DBs already patched manually)."""
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return {str(c["name"]) for c in insp.get_columns("feature_registry")}


def upgrade() -> None:
    _ensure_alembic_version_num_fits_long_ids()
    if "controllability" in _feature_registry_columns():
        return
    op.add_column(
        "feature_registry",
        sa.Column("controllability", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    if "controllability" not in _feature_registry_columns():
        return
    op.drop_column("feature_registry", "controllability")
