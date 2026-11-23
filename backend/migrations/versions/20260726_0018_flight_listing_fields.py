"""Add fields required by the public flight listing.

Revision ID: 20260726_0018
Revises: 20260726_0017
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0018"
down_revision = "20260726_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("travel_services", sa.Column("arrival_time", sa.Time()))
    op.add_column("travel_services", sa.Column("return_arrival_time", sa.Time()))
    op.add_column("travel_services", sa.Column("flight_number", sa.String(32)))
    op.add_column("travel_services", sa.Column("return_flight_number", sa.String(32)))
    op.add_column("travel_services", sa.Column("stops_count", sa.SmallInteger()))
    op.add_column("travel_services", sa.Column("available_seats", sa.SmallInteger()))
    op.create_check_constraint(
        "chk_travel_services_stops_count",
        "travel_services",
        "stops_count IS NULL OR stops_count >= 0",
    )
    op.create_check_constraint(
        "chk_travel_services_available_seats",
        "travel_services",
        "available_seats IS NULL OR available_seats >= 0",
    )
    op.create_index(
        "idx_travel_services_flight_search",
        "travel_services",
        ["service_type", "origin", "destination_name", "departure_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_travel_services_flight_search",
        table_name="travel_services",
    )
    op.drop_constraint(
        "chk_travel_services_available_seats",
        "travel_services",
        type_="check",
    )
    op.drop_constraint(
        "chk_travel_services_stops_count",
        "travel_services",
        type_="check",
    )
    op.drop_column("travel_services", "available_seats")
    op.drop_column("travel_services", "stops_count")
    op.drop_column("travel_services", "return_flight_number")
    op.drop_column("travel_services", "flight_number")
    op.drop_column("travel_services", "return_arrival_time")
    op.drop_column("travel_services", "arrival_time")
