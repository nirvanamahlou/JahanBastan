"""Add display and flight facts used by the public tour experience.

Revision ID: 20260726_0013
Revises: 20260725_0012
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0013"
down_revision = "20260725_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("airline_name", sa.String(120)))
    op.add_column("crm_tour_cache", sa.Column("flight_number", sa.String(32)))
    op.add_column("crm_tour_cache", sa.Column("departure_time", sa.Time()))
    op.add_column("crm_tour_cache", sa.Column("destination_language", sa.String(80)))
    op.add_column("crm_tour_cache", sa.Column("destination_currency", sa.String(80)))
    op.add_column("crm_tour_cache", sa.Column("rating_score", sa.Numeric(2, 1)))
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "rating_count",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_check_constraint(
        "chk_crm_tour_cache_rating_score",
        "crm_tour_cache",
        "rating_score IS NULL OR rating_score BETWEEN 0 AND 5",
    )
    op.create_check_constraint(
        "chk_crm_tour_cache_rating_count",
        "crm_tour_cache",
        "rating_count >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_crm_tour_cache_rating_count",
        "crm_tour_cache",
        type_="check",
    )
    op.drop_constraint(
        "chk_crm_tour_cache_rating_score",
        "crm_tour_cache",
        type_="check",
    )
    op.drop_column("crm_tour_cache", "rating_count")
    op.drop_column("crm_tour_cache", "rating_score")
    op.drop_column("crm_tour_cache", "destination_currency")
    op.drop_column("crm_tour_cache", "destination_language")
    op.drop_column("crm_tour_cache", "departure_time")
    op.drop_column("crm_tour_cache", "flight_number")
    op.drop_column("crm_tour_cache", "airline_name")
