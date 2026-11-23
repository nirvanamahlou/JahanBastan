"""Add editor-only notes to managed content."""

import sqlalchemy as sa
from alembic import op

revision = "20260728_0028"
down_revision = "20260728_0027"
branch_labels = None
depends_on = None


_TABLES = (
    "countries",
    "article_categories",
    "site_settings",
    "destinations",
    "hotels",
    "articles",
    "faqs",
    "crm_tour_cache",
    "travel_services",
)


def upgrade() -> None:
    for table_name in _TABLES:
        op.add_column(table_name, sa.Column("internal_note", sa.Text(), nullable=True))


def downgrade() -> None:
    for table_name in reversed(_TABLES):
        op.drop_column(table_name, "internal_note")
