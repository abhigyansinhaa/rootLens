"""Add controllability to feature_registry

Revision ID: 004_feature_registry_controllability
Revises: 003_feature_registry
Create Date: 2026-05-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_feature_registry_controllability"
down_revision: Union[str, Sequence[str], None] = "003_feature_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "feature_registry",
        sa.Column("controllability", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("feature_registry", "controllability")
