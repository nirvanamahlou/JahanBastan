"""Allow dated combined tour packages in carts and booking snapshots."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_0099"
down_revision = "20260921_0098"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_cart_items",
        sa.Column("combined_departure_price_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cart_items_combined_departure_price",
        "customer_cart_items",
        "tour_combined_departure_prices",
        ["combined_departure_price_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "uq_customer_cart_items_combined_selection",
        "customer_cart_items",
        ["cart_id", "tour_departure_id", "combined_departure_price_id"],
        unique=True,
        postgresql_where=sa.text(
            "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL "
            "AND combined_departure_price_id IS NOT NULL"
        ),
    )
    op.add_column(
        "booking_items",
        sa.Column("combined_departure_price_id", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("booking_items", "combined_departure_price_id")
    op.drop_index(
        "uq_customer_cart_items_combined_selection",
        table_name="customer_cart_items",
    )
    op.drop_constraint(
        "fk_cart_items_combined_departure_price",
        "customer_cart_items",
        type_="foreignkey",
    )
    op.drop_column("customer_cart_items", "combined_departure_price_id")
