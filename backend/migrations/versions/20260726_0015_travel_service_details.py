"""Add transport and visa details to travel services.

Revision ID: 20260726_0015
Revises: 20260726_0014
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0015"
down_revision = "20260726_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("travel_services", sa.Column("country", sa.String(100)))
    op.add_column("travel_services", sa.Column("origin", sa.String(120)))
    op.add_column("travel_services", sa.Column("destination_name", sa.String(120)))
    op.add_column("travel_services", sa.Column("departure_date", sa.Date()))
    op.add_column("travel_services", sa.Column("return_date", sa.Date()))
    op.add_column("travel_services", sa.Column("departure_time", sa.Time()))
    op.add_column("travel_services", sa.Column("return_time", sa.Time()))
    op.add_column("travel_services", sa.Column("baggage_allowance", sa.String(120)))
    op.add_column("travel_services", sa.Column("provider_company", sa.String(160)))
    op.add_column("travel_services", sa.Column("base_price", sa.Numeric(14, 0)))
    op.add_column(
        "travel_services",
        sa.Column(
            "currency", sa.String(3), nullable=False, server_default=sa.text("'IRR'")
        ),
    )
    op.add_column("travel_services", sa.Column("visa_requirements", sa.Text()))
    op.add_column("travel_services", sa.Column("visa_processing_time", sa.String(120)))
    op.create_check_constraint(
        "chk_service_return_after_departure",
        "travel_services",
        "return_date IS NULL OR departure_date IS NULL OR return_date >= departure_date",
    )
    op.create_check_constraint(
        "chk_service_base_price_nonnegative",
        "travel_services",
        "base_price IS NULL OR base_price >= 0",
    )
    op.create_index(
        "idx_travel_services_type_country_date",
        "travel_services",
        ["service_type", "country", "departure_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_travel_services_type_country_date", table_name="travel_services")
    op.drop_constraint(
        "chk_service_base_price_nonnegative", "travel_services", type_="check"
    )
    op.drop_constraint(
        "chk_service_return_after_departure", "travel_services", type_="check"
    )
    for column in (
        "visa_processing_time",
        "visa_requirements",
        "currency",
        "base_price",
        "provider_company",
        "baggage_allowance",
        "return_time",
        "departure_time",
        "return_date",
        "departure_date",
        "destination_name",
        "origin",
        "country",
    ):
        op.drop_column("travel_services", column)
