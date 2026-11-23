"""Add managed article categories and preserve existing category values.

Revision ID: 20260725_0012
Revises: 20260725_0011
"""

import sqlalchemy as sa
from alembic import op

revision = "20260725_0012"
down_revision = "20260725_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "article_categories",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )
    op.execute(
        """
        INSERT INTO article_categories (name, slug)
        SELECT DISTINCT category,
               'category-' || row_number() OVER (ORDER BY category)
        FROM articles
        WHERE trim(category) <> ''
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("article_categories")
