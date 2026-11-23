"""Add passenger capacity to tours and hotels.

Revision ID: 20260727_0021
Revises: 20260727_0020
"""

import sqlalchemy as sa
from alembic import op

revision = "20260727_0021"
down_revision = "20260727_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column("max_passengers", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "hotels",
        sa.Column("max_guests", sa.SmallInteger(), nullable=True),
    )
    op.create_check_constraint(
        "chk_crm_tour_cache_max_passengers",
        "crm_tour_cache",
        "max_passengers IS NULL OR max_passengers > 0",
    )
    op.create_check_constraint(
        "chk_hotels_max_guests",
        "hotels",
        "max_guests IS NULL OR max_guests > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_hotels_max_guests",
        "hotels",
        type_="check",
    )
    op.drop_constraint(
        "chk_crm_tour_cache_max_passengers",
        "crm_tour_cache",
        type_="check",
    )
    op.drop_column("hotels", "max_guests")
    op.drop_column("crm_tour_cache", "max_passengers")
