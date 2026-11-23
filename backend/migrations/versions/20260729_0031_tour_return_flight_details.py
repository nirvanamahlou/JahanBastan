"""add return flight details to tours

Revision ID: 20260729_0031
Revises: 20260729_0030
Create Date: 2026-07-29
"""

import sqlalchemy as sa
from alembic import op

revision = "20260729_0031"
down_revision = "20260729_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("return_date", sa.Date(), nullable=True))
    op.add_column(
        "crm_tour_cache",
        sa.Column("return_origin_airport", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column("return_destination_airport", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column("return_airline_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column("return_flight_number", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "crm_tour_cache", sa.Column("return_departure_time", sa.Time(), nullable=True)
    )
    op.add_column(
        "crm_tour_cache", sa.Column("return_arrival_time", sa.Time(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("crm_tour_cache", "return_arrival_time")
    op.drop_column("crm_tour_cache", "return_departure_time")
    op.drop_column("crm_tour_cache", "return_flight_number")
    op.drop_column("crm_tour_cache", "return_airline_name")
    op.drop_column("crm_tour_cache", "return_destination_airport")
    op.drop_column("crm_tour_cache", "return_origin_airport")
    op.drop_column("crm_tour_cache", "return_date")
