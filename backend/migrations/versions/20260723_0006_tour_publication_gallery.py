"""Add tour publication lifecycle and bounded image gallery.

Revision ID: 20260723_0006
Revises: 20260723_0005
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260723_0006"
down_revision: str | None = "20260723_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    publication_status = postgresql.ENUM(
        "draft",
        "published",
        "archived",
        name="publication_status",
        create_type=False,
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "status",
            publication_status,
            server_default="published",
            nullable=False,
        ),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column("published_at", sa.DateTime(timezone=True)),
    )
    op.execute("UPDATE crm_tour_cache SET published_at = COALESCE(synced_at, now())")
    op.create_check_constraint(
        "chk_crm_tour_cache_publication_time",
        "crm_tour_cache",
        "status <> 'published' OR published_at IS NOT NULL",
    )
    op.create_table(
        "tour_images",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "tour_id",
            sa.BigInteger(),
            sa.ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "image_id",
            sa.BigInteger(),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
        ),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 5",
            name="chk_tour_images_display_order",
        ),
        sa.UniqueConstraint(
            "tour_id",
            "image_id",
            name="uq_tour_images_image",
        ),
        sa.UniqueConstraint(
            "tour_id",
            "display_order",
            name="uq_tour_images_order",
        ),
    )


def downgrade() -> None:
    op.drop_table("tour_images")
    op.drop_constraint(
        "chk_crm_tour_cache_publication_time",
        "crm_tour_cache",
        type_="check",
    )
    op.drop_column("crm_tour_cache", "published_at")
    op.drop_column("crm_tour_cache", "status")
