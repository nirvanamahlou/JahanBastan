"""Add structured tour dates, itinerary, documents, notes, and hotel packages.

Revision ID: 20260725_0010
Revises: 20260725_0009
"""

import sqlalchemy as sa
from alembic import op

revision = "20260725_0010"
down_revision = "20260725_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_tour_cache", sa.Column("required_documents", sa.Text()))
    op.add_column("crm_tour_cache", sa.Column("tour_notes", sa.Text()))
    op.add_column("crm_tour_cache", sa.Column("stay_nights", sa.SmallInteger()))

    op.create_table(
        "tour_itinerary_days",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("tour_id", sa.BigInteger(), nullable=False),
        sa.Column("day_number", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.CheckConstraint("day_number BETWEEN 1 AND 365", name="chk_itinerary_day"),
        sa.ForeignKeyConstraint(["tour_id"], ["crm_tour_cache.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tour_id", "day_number", name="uq_tour_itinerary_day"),
    )
    op.create_table(
        "tour_departures",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("tour_id", sa.BigInteger(), nullable=False),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("departure_date", sa.Date()),
        sa.Column("price_amount", sa.Numeric(14, 0)),
        sa.Column("currency", sa.String(3), server_default="IRR", nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "price_amount IS NULL OR price_amount >= 0",
            name="chk_departure_price",
        ),
        sa.ForeignKeyConstraint(["tour_id"], ["crm_tour_cache.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tour_id", "display_order", name="uq_tour_departure_order"),
    )
    op.create_table(
        "tour_hotel_packages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("tour_id", sa.BigInteger(), nullable=False),
        sa.Column("hotel_id", sa.BigInteger(), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("nights", sa.SmallInteger(), nullable=False),
        sa.Column("board_type", sa.String(40)),
        sa.Column("double_price", sa.Numeric(14, 0)),
        sa.Column("single_price", sa.Numeric(14, 0)),
        sa.Column("child_with_bed_price", sa.Numeric(14, 0)),
        sa.Column("child_without_bed_price", sa.Numeric(14, 0)),
        sa.Column("currency", sa.String(3), server_default="IRR", nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("nights > 0", name="chk_tour_hotel_package_nights"),
        sa.CheckConstraint(
            "double_price IS NULL OR double_price >= 0",
            name="chk_tour_hotel_double_price",
        ),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tour_id"], ["crm_tour_cache.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tour_id", "display_order", name="uq_tour_hotel_package_order"
        ),
    )
    op.create_index(
        "idx_tour_departures_tour_date",
        "tour_departures",
        ["tour_id", "departure_date"],
    )
    op.create_index(
        "idx_tour_hotel_packages_tour",
        "tour_hotel_packages",
        ["tour_id", "display_order"],
    )


def downgrade() -> None:
    op.drop_index("idx_tour_hotel_packages_tour", table_name="tour_hotel_packages")
    op.drop_index("idx_tour_departures_tour_date", table_name="tour_departures")
    op.drop_table("tour_hotel_packages")
    op.drop_table("tour_departures")
    op.drop_table("tour_itinerary_days")
    op.drop_column("crm_tour_cache", "stay_nights")
    op.drop_column("crm_tour_cache", "tour_notes")
    op.drop_column("crm_tour_cache", "required_documents")
