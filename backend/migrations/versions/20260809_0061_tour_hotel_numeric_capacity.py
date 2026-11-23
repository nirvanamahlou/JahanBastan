"""Add numeric capacity to tour hotel offers and reservation audit fields."""

import sqlalchemy as sa
from alembic import op

revision = "20260809_0061"
down_revision = "20260809_0060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour_departure_hotel_prices", sa.Column("capacity_total", sa.SmallInteger())
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column("capacity_remaining", sa.SmallInteger()),
    )
    op.create_check_constraint(
        "chk_tdhp_capacity_total",
        "tour_departure_hotel_prices",
        "capacity_total IS NULL OR capacity_total >= 0",
    )
    op.create_check_constraint(
        "chk_tdhp_capacity_remaining",
        "tour_departure_hotel_prices",
        "capacity_remaining IS NULL OR capacity_remaining >= 0",
    )
    op.create_index(
        "idx_tdhp_available_capacity",
        "tour_departure_hotel_prices",
        ["departure_id", "is_available", "capacity_remaining"],
    )
    op.add_column(
        "booking_requests",
        sa.Column("capacity_reserved_at", sa.DateTime(timezone=True)),
    )
    op.add_column(
        "booking_requests",
        sa.Column("capacity_released_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_column("booking_requests", "capacity_released_at")
    op.drop_column("booking_requests", "capacity_reserved_at")
    op.drop_index(
        "idx_tdhp_available_capacity", table_name="tour_departure_hotel_prices"
    )
    op.drop_constraint(
        "chk_tdhp_capacity_remaining", "tour_departure_hotel_prices", type_="check"
    )
    op.drop_constraint(
        "chk_tdhp_capacity_total", "tour_departure_hotel_prices", type_="check"
    )
    op.drop_column("tour_departure_hotel_prices", "capacity_remaining")
    op.drop_column("tour_departure_hotel_prices", "capacity_total")
