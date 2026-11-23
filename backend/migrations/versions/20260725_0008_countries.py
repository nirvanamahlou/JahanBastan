"""Add CMS-managed countries and destination filtering.

Revision ID: 20260725_0008
Revises: 20260725_0007
Create Date: 2026-07-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260725_0008"
down_revision: str | None = "20260725_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    status = postgresql.ENUM(
        "draft",
        "published",
        "archived",
        name="publication_status",
        create_type=False,
    )
    op.create_table(
        "countries",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column(
            "image_id",
            sa.BigInteger(),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "display_order", sa.SmallInteger(), server_default="0", nullable=False
        ),
        sa.Column("status", status, server_default="draft", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_countries_publication_time",
        ),
    )
    op.create_index(
        "idx_countries_published_order",
        "countries",
        ["display_order"],
        postgresql_where=sa.text("status = 'published'"),
    )
    op.execute(
        """
        INSERT INTO countries (name, slug, status, published_at)
        SELECT DISTINCT country,
               'country-' || substr(md5(country), 1, 12),
               'published'::publication_status,
               now()
        FROM destinations
        WHERE country IS NOT NULL AND country <> ''
        """
    )
    op.create_index(
        "idx_destinations_country_status",
        "destinations",
        ["country", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_destinations_country_status", table_name="destinations")
    op.drop_index("idx_countries_published_order", table_name="countries")
    op.drop_table("countries")
