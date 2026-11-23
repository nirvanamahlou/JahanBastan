"""Add tour-specific airports and best travel time.

Revision ID: 20260726_0014
Revises: 20260726_0013
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0014"
down_revision = "20260726_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("origin_airport", sa.String(160)))
    op.add_column("crm_tour_cache", sa.Column("destination_airport", sa.String(160)))
    op.add_column("crm_tour_cache", sa.Column("best_travel_time", sa.String(300)))


def downgrade() -> None:
    op.drop_column("crm_tour_cache", "best_travel_time")
    op.drop_column("crm_tour_cache", "destination_airport")
    op.drop_column("crm_tour_cache", "origin_airport")
