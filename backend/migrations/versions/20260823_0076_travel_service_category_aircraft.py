"""Add category and aircraft model to managed travel services."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0076"
down_revision = "20260822_0075"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("service_category", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("aircraft_model", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("travel_services", "aircraft_model")
    op.drop_column("travel_services", "service_category")
