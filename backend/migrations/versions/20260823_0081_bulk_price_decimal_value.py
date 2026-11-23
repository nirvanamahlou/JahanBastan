"""Preserve decimal percentage values in bulk pricing audit."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0081"
down_revision = "20260823_0080"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "bulk_price_adjustments",
        "amount_toman",
        type_=sa.Numeric(14, 4),
        existing_type=sa.Numeric(14, 0),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "bulk_price_adjustments",
        "amount_toman",
        type_=sa.Numeric(14, 0),
        existing_type=sa.Numeric(14, 4),
        existing_nullable=False,
    )
