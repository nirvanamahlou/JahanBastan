"""Add managed tour hotel/media fields and travel services.

Revision ID: 20260723_0005
Revises: 20260723_0004
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260723_0005"
down_revision: str | None = "20260723_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("hotel_id", sa.BigInteger()))
    op.add_column("crm_tour_cache", sa.Column("hotel_name", sa.String(180)))
    op.add_column("crm_tour_cache", sa.Column("image_id", sa.BigInteger()))
    op.create_foreign_key(
        "fk_crm_tour_cache_hotel",
        "crm_tour_cache",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_crm_tour_cache_image",
        "crm_tour_cache",
        "media_assets",
        ["image_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "travel_services",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False, unique=True),
        sa.Column("service_type", sa.String(40), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_id", sa.BigInteger()),
        sa.Column(
            "display_order", sa.SmallInteger(), server_default="0", nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft",
                "published",
                "archived",
                name="publication_status",
                create_type=False,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("meta_title", sa.String(70)),
        sa.Column("meta_description", sa.String(160)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_travel_services_publication_time",
        ),
    )
    op.create_index(
        "idx_travel_services_published",
        "travel_services",
        ["display_order", "id"],
        postgresql_where=sa.text("status = 'published'"),
    )


def downgrade() -> None:
    op.drop_table("travel_services")
    op.drop_constraint("fk_crm_tour_cache_image", "crm_tour_cache", type_="foreignkey")
    op.drop_constraint("fk_crm_tour_cache_hotel", "crm_tour_cache", type_="foreignkey")
    op.drop_column("crm_tour_cache", "image_id")
    op.drop_column("crm_tour_cache", "hotel_name")
    op.drop_column("crm_tour_cache", "hotel_id")
