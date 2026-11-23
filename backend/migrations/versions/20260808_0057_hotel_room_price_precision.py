"""Preserve decimal prices imported for hotel room categories."""

import sqlalchemy as sa
from alembic import op

revision = "20260808_0057"
down_revision = "20260808_0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "hotel_rooms",
        "price_amount",
        existing_type=sa.Numeric(precision=14, scale=0),
        type_=sa.Numeric(precision=16, scale=2),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "hotel_rooms",
        "price_amount",
        existing_type=sa.Numeric(precision=16, scale=2),
        type_=sa.Numeric(precision=14, scale=0),
        existing_nullable=False,
    )
