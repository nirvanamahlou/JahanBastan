"""Add date-specific tour room selections and approval-time quotes."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260802_0047"
down_revision = "20260802_0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        "uq_customer_cart_items_tour_selection",
        table_name="customer_cart_items",
    )
    op.add_column(
        "customer_cart_items",
        sa.Column("tour_hotel_price_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column(
            "room_selection",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    for name in ("hotel_amount", "flight_amount"):
        op.add_column(
            "customer_cart_items",
            sa.Column(name, sa.Numeric(16, 2), nullable=True),
        )
    for name in ("hotel_currency", "flight_currency"):
        op.add_column(
            "customer_cart_items",
            sa.Column(name, sa.String(3), nullable=True),
        )
    op.create_foreign_key(
        "fk_cart_tour_hotel_price",
        "customer_cart_items",
        "tour_departure_hotel_prices",
        ["tour_hotel_price_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "uq_customer_cart_items_tour_selection",
        "customer_cart_items",
        ["customer_id", "tour_departure_id", "tour_hotel_price_id"],
        unique=True,
        postgresql_where=sa.text(
            "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL "
            "AND tour_hotel_price_id IS NOT NULL"
        ),
    )

    for table_name in ("booking_items",):
        op.add_column(table_name, sa.Column("tour_hotel_price_id", sa.BigInteger()))
        op.add_column(
            table_name,
            sa.Column(
                "room_selection",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )
        for name in ("hotel_amount", "flight_amount"):
            op.add_column(table_name, sa.Column(name, sa.Numeric(16, 2)))
        for name in ("hotel_currency", "flight_currency"):
            op.add_column(table_name, sa.Column(name, sa.String(3)))

    op.drop_constraint("chk_booking_items_price", "booking_items", type_="check")
    op.create_check_constraint(
        "chk_booking_items_price",
        "booking_items",
        "price_amount IS NULL OR price_amount > 0",
    )
    op.alter_column(
        "booking_items",
        "price_amount",
        existing_type=sa.Numeric(14, 0),
        nullable=True,
    )
    op.alter_column(
        "booking_items",
        "currency",
        existing_type=sa.String(3),
        nullable=True,
    )
    op.drop_constraint("chk_booking_requests_total", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_total",
        "booking_requests",
        "total_amount IS NULL OR total_amount > 0",
    )
    op.alter_column(
        "booking_requests",
        "total_amount",
        existing_type=sa.Numeric(14, 0),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("DELETE FROM booking_requests WHERE total_amount IS NULL")
    op.execute("DELETE FROM booking_items WHERE price_amount IS NULL")
    op.execute("UPDATE booking_items SET currency = 'IRT' WHERE currency IS NULL")
    op.alter_column(
        "booking_items",
        "currency",
        existing_type=sa.String(3),
        nullable=False,
    )
    op.alter_column(
        "booking_requests",
        "total_amount",
        existing_type=sa.Numeric(14, 0),
        nullable=False,
    )
    op.drop_constraint("chk_booking_requests_total", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_total", "booking_requests", "total_amount > 0"
    )
    op.alter_column(
        "booking_items", "price_amount", existing_type=sa.Numeric(14, 0), nullable=False
    )
    op.drop_constraint("chk_booking_items_price", "booking_items", type_="check")
    op.create_check_constraint(
        "chk_booking_items_price", "booking_items", "price_amount > 0"
    )
    for table_name in ("booking_items",):
        for name in (
            "flight_currency",
            "hotel_currency",
            "flight_amount",
            "hotel_amount",
            "room_selection",
            "tour_hotel_price_id",
        ):
            op.drop_column(table_name, name)
    op.drop_index(
        "uq_customer_cart_items_tour_selection", table_name="customer_cart_items"
    )
    op.drop_constraint(
        "fk_cart_tour_hotel_price", "customer_cart_items", type_="foreignkey"
    )
    for name in (
        "flight_currency",
        "hotel_currency",
        "flight_amount",
        "hotel_amount",
        "room_selection",
        "tour_hotel_price_id",
    ):
        op.drop_column("customer_cart_items", name)
    op.create_index(
        "uq_customer_cart_items_tour_selection",
        "customer_cart_items",
        ["customer_id", "tour_departure_id", "hotel_package_id"],
        unique=True,
        postgresql_where=sa.text(
            "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL "
            "AND hotel_package_id IS NOT NULL"
        ),
    )
