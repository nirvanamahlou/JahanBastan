"""Add structured hotel content and pricing.

Revision ID: 20260726_0017
Revises: 20260726_0016
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0017"
down_revision = "20260726_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hotels", sa.Column("location_description", sa.Text()))
    op.add_column("hotels", sa.Column("rooms_description", sa.Text()))
    op.add_column("hotels", sa.Column("amenities_description", sa.Text()))
    op.add_column("hotels", sa.Column("dining_description", sa.Text()))
    op.add_column("hotels", sa.Column("booking_description", sa.Text()))
    op.add_column("hotels", sa.Column("pricing_description", sa.Text()))
    op.add_column("hotels", sa.Column("policies_description", sa.Text()))
    op.add_column("hotels", sa.Column("base_price", sa.Numeric(14, 0)))
    op.add_column(
        "hotels",
        sa.Column("currency", sa.String(3), server_default="IRT", nullable=False),
    )
    op.create_check_constraint(
        "chk_hotels_base_price",
        "hotels",
        "base_price IS NULL OR base_price >= 0",
    )
    op.create_check_constraint(
        "chk_hotels_currency",
        "hotels",
        "currency ~ '^[A-Z]{3}$'",
    )


def downgrade() -> None:
    op.drop_constraint("chk_hotels_currency", "hotels", type_="check")
    op.drop_constraint("chk_hotels_base_price", "hotels", type_="check")
    op.drop_column("hotels", "currency")
    op.drop_column("hotels", "base_price")
    op.drop_column("hotels", "policies_description")
    op.drop_column("hotels", "pricing_description")
    op.drop_column("hotels", "booking_description")
    op.drop_column("hotels", "dining_description")
    op.drop_column("hotels", "amenities_description")
    op.drop_column("hotels", "rooms_description")
    op.drop_column("hotels", "location_description")
