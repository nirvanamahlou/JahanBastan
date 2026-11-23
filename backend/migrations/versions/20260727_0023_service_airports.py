"""Add origin and destination airports to travel services."""

import sqlalchemy as sa
from alembic import op

revision = "20260727_0023"
down_revision = "20260727_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("origin_airport", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("destination_airport", sa.String(length=160), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("travel_services", "destination_airport")
    op.drop_column("travel_services", "origin_airport")
