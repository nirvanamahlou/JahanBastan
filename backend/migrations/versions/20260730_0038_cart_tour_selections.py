"""persist tour departure and hotel-package selections in customer carts

Revision ID: 20260730_0038
Revises: 20260730_0037
Create Date: 2026-07-30
"""

import sqlalchemy as sa
from alembic import op

revision = "20260730_0038"
down_revision = "20260730_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_cart_items",
        sa.Column(
            "tour_departure_id",
            sa.BigInteger(),
            sa.ForeignKey("tour_departures.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.add_column(
        "customer_cart_items",
        sa.Column(
            "hotel_package_id",
            sa.BigInteger(),
            sa.ForeignKey("tour_hotel_packages.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.drop_index("uq_customer_cart_items_tour", table_name="customer_cart_items")
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


def downgrade() -> None:
    op.drop_index(
        "uq_customer_cart_items_tour_selection",
        table_name="customer_cart_items",
    )
    op.create_index(
        "uq_customer_cart_items_tour",
        "customer_cart_items",
        ["customer_id", "tour_id"],
        unique=True,
        postgresql_where=sa.text("tour_id IS NOT NULL"),
    )
    op.drop_column("customer_cart_items", "hotel_package_id")
    op.drop_column("customer_cart_items", "tour_departure_id")
