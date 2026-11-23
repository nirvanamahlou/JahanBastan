"""Add flight class to travel services.

Revision ID: 20260726_0016
Revises: 20260726_0015
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0016"
down_revision = "20260726_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("travel_services", sa.Column("flight_class", sa.String(32)))
    op.create_check_constraint(
        "chk_travel_services_flight_class",
        "travel_services",
        "flight_class IS NULL OR flight_class IN "
        "('economy', 'premium_economy', 'business', 'first')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_travel_services_flight_class",
        "travel_services",
        type_="check",
    )
    op.drop_column("travel_services", "flight_class")
