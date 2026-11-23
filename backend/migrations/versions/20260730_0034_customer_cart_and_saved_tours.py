"""add customer carts, saved tours, and profile fields

Revision ID: 20260730_0034
Revises: 20260730_0033
Create Date: 2026-07-30
"""

import sqlalchemy as sa
from alembic import op

revision = "20260730_0034"
down_revision = "20260730_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customer_users", sa.Column("phone", sa.String(length=32)))
    op.add_column("customer_users", sa.Column("address", sa.Text()))

    op.create_table(
        "customer_cart_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_type", sa.String(length=16), nullable=False),
        sa.Column(
            "tour_id",
            sa.BigInteger(),
            sa.ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "travel_service_id",
            sa.BigInteger(),
            sa.ForeignKey("travel_services.id", ondelete="CASCADE"),
        ),
        sa.Column("title_snapshot", sa.String(length=180), nullable=False),
        sa.Column("details_snapshot", sa.String(length=300)),
        sa.Column("price_amount", sa.Numeric(14, 0)),
        sa.Column("currency", sa.String(length=3)),
        sa.Column("image_id", sa.BigInteger()),
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
            "item_type IN ('tour', 'flight')", name="chk_customer_cart_items_type"
        ),
        sa.CheckConstraint(
            "(tour_id IS NOT NULL AND travel_service_id IS NULL) OR "
            "(tour_id IS NULL AND travel_service_id IS NOT NULL)",
            name="chk_customer_cart_items_source",
        ),
    )
    op.create_index(
        "idx_customer_cart_items_customer_updated",
        "customer_cart_items",
        ["customer_id", "updated_at"],
    )
    op.create_index(
        "uq_customer_cart_items_tour",
        "customer_cart_items",
        ["customer_id", "tour_id"],
        unique=True,
        postgresql_where=sa.text("tour_id IS NOT NULL"),
    )
    op.create_index(
        "uq_customer_cart_items_flight",
        "customer_cart_items",
        ["customer_id", "travel_service_id"],
        unique=True,
        postgresql_where=sa.text("travel_service_id IS NOT NULL"),
    )

    op.create_table(
        "customer_saved_tours",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tour_id",
            sa.BigInteger(),
            sa.ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
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
        sa.UniqueConstraint("customer_id", "tour_id", name="uq_customer_saved_tours"),
    )
    op.create_index(
        "idx_customer_saved_tours_customer_created",
        "customer_saved_tours",
        ["customer_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_customer_saved_tours_customer_created",
        table_name="customer_saved_tours",
    )
    op.drop_table("customer_saved_tours")
    op.drop_index("uq_customer_cart_items_flight", table_name="customer_cart_items")
    op.drop_index("uq_customer_cart_items_tour", table_name="customer_cart_items")
    op.drop_index(
        "idx_customer_cart_items_customer_updated",
        table_name="customer_cart_items",
    )
    op.drop_table("customer_cart_items")
    op.drop_column("customer_users", "address")
    op.drop_column("customer_users", "phone")
