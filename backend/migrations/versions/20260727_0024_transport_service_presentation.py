"""Add transport presentation fields to travel services."""

import sqlalchemy as sa
from alembic import op

revision = "20260727_0024"
down_revision = "20260727_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("provider_icon_image_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("origin_terminal", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("destination_terminal", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("transport_class", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("travel_services", "transport_class")
    op.drop_column("travel_services", "destination_terminal")
    op.drop_column("travel_services", "origin_terminal")
    op.drop_column("travel_services", "provider_icon_image_id")
