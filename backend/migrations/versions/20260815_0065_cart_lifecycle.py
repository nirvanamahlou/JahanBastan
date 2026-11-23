"""Preserve travel carts, price refreshes, and customer cart audit events."""

import sqlalchemy as sa
from alembic import op

revision = "20260815_0065"
down_revision = "20260810_0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_carts",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="active", nullable=False
        ),
        sa.Column(
            "currency", sa.String(length=3), server_default="IRT", nullable=False
        ),
        sa.Column("subtotal_amount", sa.Numeric(14, 0), nullable=True),
        sa.Column(
            "discount_amount", sa.Numeric(14, 0), server_default="0", nullable=False
        ),
        sa.Column("total_amount", sa.Numeric(14, 0), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("converted_booking_id", sa.BigInteger(), nullable=True),
        sa.Column("assigned_admin_id", sa.BigInteger(), nullable=True),
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
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'abandoned', 'converted', 'expired', 'cancelled')",
            name="chk_customer_carts_status",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer_users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["converted_booking_id"], ["booking_requests.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["assigned_admin_id"], ["admin_users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "idx_customer_carts_customer_status",
        "customer_carts",
        ["customer_id", "status", "updated_at"],
    )
    op.create_index(
        "uq_customer_carts_active_customer",
        "customer_carts",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.add_column(
        "customer_cart_items", sa.Column("cart_id", sa.BigInteger(), nullable=True)
    )
    op.add_column(
        "customer_cart_items",
        sa.Column(
            "status", sa.String(length=32), server_default="active", nullable=False
        ),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("price_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_price_amount", sa.Numeric(14, 0), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_currency", sa.String(length=3), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_hotel_amount", sa.Numeric(16, 2), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_hotel_currency", sa.String(length=3), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_flight_amount", sa.Numeric(16, 2), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("current_flight_currency", sa.String(length=3), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column(
            "product_snapshot",
            sa.JSON(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.execute(
        """
        INSERT INTO customer_carts (customer_id, status, currency, expires_at, last_activity_at)
        SELECT DISTINCT customer_id, 'active', 'IRT', now() + interval '2 hours', now()
        FROM customer_cart_items
        """
    )
    op.execute(
        """
        UPDATE customer_cart_items AS item
        SET cart_id = cart.id,
            price_checked_at = COALESCE(item.updated_at, item.created_at, now()),
            expires_at = now() + interval '2 hours',
            current_price_amount = item.price_amount,
            current_currency = item.currency,
            current_hotel_amount = item.hotel_amount,
            current_hotel_currency = item.hotel_currency,
            current_flight_amount = item.flight_amount,
            current_flight_currency = item.flight_currency,
            product_snapshot = jsonb_build_object(
                'title', item.title_snapshot,
                'details', item.details_snapshot,
                'itemType', item.item_type
            )
        FROM customer_carts AS cart
        WHERE cart.customer_id = item.customer_id AND cart.status = 'active'
        """
    )
    op.alter_column("customer_cart_items", "cart_id", nullable=False)
    op.create_foreign_key(
        "fk_customer_cart_items_cart",
        "customer_cart_items",
        "customer_carts",
        ["cart_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(
        "uq_customer_cart_items_tour_selection", table_name="customer_cart_items"
    )
    op.drop_index("uq_customer_cart_items_flight", table_name="customer_cart_items")
    op.create_index(
        "idx_customer_cart_items_cart_status",
        "customer_cart_items",
        ["cart_id", "status", "updated_at"],
    )
    op.create_index(
        "uq_customer_cart_items_tour_selection",
        "customer_cart_items",
        ["cart_id", "tour_departure_id", "tour_hotel_price_id"],
        unique=True,
        postgresql_where=sa.text(
            "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL AND tour_hotel_price_id IS NOT NULL"
        ),
    )
    op.create_index(
        "uq_customer_cart_items_flight",
        "customer_cart_items",
        ["cart_id", "travel_service_id"],
        unique=True,
        postgresql_where=sa.text("travel_service_id IS NOT NULL"),
    )

    op.create_table(
        "cart_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("cart_id", sa.BigInteger(), nullable=False),
        sa.Column("cart_item_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_type", sa.String(length=16), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "payload", sa.JSON(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cart_id"], ["customer_carts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["cart_item_id"], ["customer_cart_items.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer_users.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "idx_cart_events_cart_created", "cart_events", ["cart_id", "created_at"]
    )
    op.create_index(
        "idx_cart_events_customer_created", "cart_events", ["customer_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_cart_events_customer_created", table_name="cart_events")
    op.drop_index("idx_cart_events_cart_created", table_name="cart_events")
    op.drop_table("cart_events")
    op.drop_index("uq_customer_cart_items_flight", table_name="customer_cart_items")
    op.drop_index(
        "uq_customer_cart_items_tour_selection", table_name="customer_cart_items"
    )
    op.drop_index(
        "idx_customer_cart_items_cart_status", table_name="customer_cart_items"
    )
    op.create_index(
        "uq_customer_cart_items_tour_selection",
        "customer_cart_items",
        ["customer_id", "tour_departure_id", "tour_hotel_price_id"],
        unique=True,
        postgresql_where=sa.text(
            "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL AND tour_hotel_price_id IS NOT NULL"
        ),
    )
    op.create_index(
        "uq_customer_cart_items_flight",
        "customer_cart_items",
        ["customer_id", "travel_service_id"],
        unique=True,
        postgresql_where=sa.text("travel_service_id IS NOT NULL"),
    )
    op.drop_constraint(
        "fk_customer_cart_items_cart", "customer_cart_items", type_="foreignkey"
    )
    for column in (
        "product_snapshot",
        "current_flight_currency",
        "current_flight_amount",
        "current_hotel_currency",
        "current_hotel_amount",
        "current_currency",
        "current_price_amount",
        "expires_at",
        "price_checked_at",
        "status",
        "cart_id",
    ):
        op.drop_column("customer_cart_items", column)
    op.drop_index("uq_customer_carts_active_customer", table_name="customer_carts")
    op.drop_index("idx_customer_carts_customer_status", table_name="customer_carts")
    op.drop_table("customer_carts")
