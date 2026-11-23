"""Add independently managed SEO metadata to tours.

Revision ID: 20260725_0011
Revises: 20260725_0010
"""

import sqlalchemy as sa
from alembic import op

revision = "20260725_0011"
down_revision = "20260725_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("meta_title", sa.String(70)))
    op.add_column("crm_tour_cache", sa.Column("meta_description", sa.String(160)))


def downgrade() -> None:
    op.drop_column("crm_tour_cache", "meta_description")
    op.drop_column("crm_tour_cache", "meta_title")
