"""Make tour travel-leg journey fields optional.

Revision ID: 20260901_0084
Revises: 20260827_0083
Create Date: 2026-09-01
"""

import sqlalchemy as sa
from alembic import op

revision = "20260901_0084"
down_revision = "20260827_0083"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column_name, column_type in (
        ("transportation", sa.String(length=50)),
        ("departure_date", sa.Date()),
        ("origin", sa.String(length=120)),
        ("destination", sa.String(length=120)),
    ):
        op.alter_column(
            "tour_travel_legs",
            column_name,
            existing_type=column_type,
            nullable=True,
        )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE tour_travel_legs SET "
            "transportation = COALESCE(transportation, 'ثبت نشده'), "
            "departure_date = COALESCE(departure_date, CURRENT_DATE), "
            "origin = COALESCE(origin, 'ثبت نشده'), "
            "destination = COALESCE(destination, 'ثبت نشده')"
        )
    )
    for column_name, column_type in (
        ("transportation", sa.String(length=50)),
        ("departure_date", sa.Date()),
        ("origin", sa.String(length=120)),
        ("destination", sa.String(length=120)),
    ):
        op.alter_column(
            "tour_travel_legs",
            column_name,
            existing_type=column_type,
            nullable=False,
        )
