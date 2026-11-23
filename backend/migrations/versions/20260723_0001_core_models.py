"""Create the six core website data models.

Revision ID: 20260723_0001
Revises:
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260723_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

publication_status = postgresql.ENUM(
    "draft",
    "published",
    "archived",
    name="publication_status",
    create_type=False,
)


def upgrade() -> None:
    """Create the core content, admin, and CRM tour projection tables."""
    publication_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "site_settings",
        sa.Column("id", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column("site_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32)),
        sa.Column("email", sa.String(254)),
        sa.Column("address", sa.Text()),
        sa.Column("working_hours", sa.String(160)),
        sa.Column(
            "social_links",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
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
        sa.CheckConstraint("id = 1", name="chk_site_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "admin_users",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.String(32),
            server_default="editor",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
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
            "role IN ('super_admin', 'admin', 'editor')",
            name="chk_admin_users_role",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(
        "idx_admin_users_active",
        "admin_users",
        ["email"],
        postgresql_where=sa.text("is_active = true"),
    )

    op.create_table(
        "destinations",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("attractions", sa.Text()),
        sa.Column("best_travel_time", sa.String(160)),
        sa.Column("travel_tips", sa.Text()),
        sa.Column("image_id", sa.BigInteger()),
        sa.Column(
            "status",
            publication_status,
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "is_featured",
            sa.Boolean(),
            server_default=sa.text("false"),
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
            name="chk_destinations_publication_time",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "idx_destinations_published",
        "destinations",
        [sa.text("published_at DESC")],
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "idx_destinations_featured",
        "destinations",
        [sa.text("published_at DESC")],
        postgresql_where=sa.text("status = 'published' AND is_featured = true"),
    )

    op.create_table(
        "articles",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("destination_id", sa.BigInteger()),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("excerpt", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("image_id", sa.BigInteger()),
        sa.Column(
            "status",
            publication_status,
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
            name="chk_articles_publication_time",
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"], ["destinations.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "idx_articles_published",
        "articles",
        [sa.text("published_at DESC")],
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "idx_articles_destination_published",
        "articles",
        ["destination_id", sa.text("published_at DESC")],
        postgresql_where=sa.text("status = 'published'"),
    )

    op.create_table(
        "faqs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("destination_id", sa.BigInteger()),
        sa.Column("question", sa.String(250), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column(
            "display_order",
            sa.SmallInteger(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "status",
            publication_status,
            server_default="draft",
            nullable=False,
        ),
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
        sa.CheckConstraint("display_order >= 0", name="chk_faqs_display_order"),
        sa.CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_faqs_publication_time",
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"], ["destinations.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_faqs_published_order",
        "faqs",
        ["display_order", "id"],
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "idx_faqs_destination_published",
        "faqs",
        ["destination_id", "display_order"],
        postgresql_where=sa.text("status = 'published'"),
    )

    op.create_table(
        "crm_tour_cache",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("external_crm_id", sa.String(128), nullable=False),
        sa.Column("destination_id", sa.BigInteger()),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("origin", sa.String(100)),
        sa.Column("tour_type", sa.String(32)),
        sa.Column("duration_days", sa.SmallInteger()),
        sa.Column("departure_date", sa.Date()),
        sa.Column("price_amount", sa.Numeric(14, 0)),
        sa.Column("currency", sa.String(3)),
        sa.Column("transportation", sa.String(120)),
        sa.Column("summary", sa.String(300)),
        sa.Column("description", sa.Text()),
        sa.Column(
            "availability_status",
            sa.String(32),
            server_default="unknown",
            nullable=False,
        ),
        sa.Column(
            "is_featured",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("crm_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("raw_version", sa.String(128)),
        sa.CheckConstraint(
            "currency IS NULL OR currency ~ '^[A-Z]{3}$'",
            name="chk_crm_tour_cache_currency",
        ),
        sa.CheckConstraint(
            "duration_days IS NULL OR duration_days > 0",
            name="chk_crm_tour_cache_duration",
        ),
        sa.CheckConstraint(
            "price_amount IS NULL OR price_amount >= 0",
            name="chk_crm_tour_cache_price",
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"], ["destinations.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_crm_id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "idx_crm_tour_cache_listing",
        "crm_tour_cache",
        ["departure_date", "id"],
        postgresql_where=sa.text("availability_status = 'available'"),
    )
    op.create_index(
        "idx_crm_tour_cache_destination",
        "crm_tour_cache",
        ["destination_id", "departure_date"],
        postgresql_where=sa.text("availability_status = 'available'"),
    )
    op.create_index(
        "idx_crm_tour_cache_featured",
        "crm_tour_cache",
        ["departure_date"],
        postgresql_where=sa.text(
            "availability_status = 'available' AND is_featured = true"
        ),
    )
    op.create_index(
        "idx_crm_tour_cache_filters",
        "crm_tour_cache",
        ["tour_type", "origin", "price_amount"],
    )


def downgrade() -> None:
    """Remove the six core models in dependency-safe order."""
    op.drop_table("crm_tour_cache")
    op.drop_table("faqs")
    op.drop_table("articles")
    op.drop_table("destinations")
    op.drop_table("admin_users")
    op.drop_table("site_settings")
    publication_status.drop(op.get_bind(), checkfirst=True)
