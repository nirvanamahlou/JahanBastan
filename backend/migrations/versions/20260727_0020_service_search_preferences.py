"""Add train and flight search preference fields.

Revision ID: 20260727_0020
Revises: 20260726_0019
"""

import sqlalchemy as sa
from alembic import op

revision = "20260727_0020"
down_revision = "20260726_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("trip_type", sa.String(16), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("compartment_type", sa.String(16), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column("passenger_category", sa.String(16), nullable=True),
    )
    op.add_column(
        "travel_services",
        sa.Column(
            "car_transport",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "travel_services",
        sa.Column("flight_scope", sa.String(16), nullable=True),
    )
    op.create_check_constraint(
        "chk_travel_services_trip_type",
        "travel_services",
        "trip_type IS NULL OR trip_type IN ('one_way', 'round_trip')",
    )
    op.create_check_constraint(
        "chk_travel_services_compartment_type",
        "travel_services",
        "compartment_type IS NULL OR compartment_type IN ('regular', 'private')",
    )
    op.create_check_constraint(
        "chk_travel_services_passenger_category",
        "travel_services",
        "passenger_category IS NULL OR passenger_category IN ('all', 'women', 'men')",
    )
    op.create_check_constraint(
        "chk_travel_services_flight_scope",
        "travel_services",
        "flight_scope IS NULL OR flight_scope IN ('domestic', 'international')",
    )
    op.create_index(
        "idx_travel_services_public_preferences",
        "travel_services",
        ["service_type", "flight_scope", "trip_type"],
        postgresql_where=sa.text("status = 'published'"),
    )


def downgrade() -> None:
    op.drop_index(
        "idx_travel_services_public_preferences",
        table_name="travel_services",
    )
    op.drop_constraint(
        "chk_travel_services_flight_scope",
        "travel_services",
        type_="check",
    )
    op.drop_constraint(
        "chk_travel_services_passenger_category",
        "travel_services",
        type_="check",
    )
    op.drop_constraint(
        "chk_travel_services_compartment_type",
        "travel_services",
        type_="check",
    )
    op.drop_constraint(
        "chk_travel_services_trip_type",
        "travel_services",
        type_="check",
    )
    op.drop_column("travel_services", "flight_scope")
    op.drop_column("travel_services", "car_transport")
    op.drop_column("travel_services", "passenger_category")
    op.drop_column("travel_services", "compartment_type")
    op.drop_column("travel_services", "trip_type")
