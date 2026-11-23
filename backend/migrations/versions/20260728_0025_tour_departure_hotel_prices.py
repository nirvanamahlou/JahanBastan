"""Add hotel codes and date-specific tour hotel prices."""

import sqlalchemy as sa
from alembic import op

revision = "20260728_0025"
down_revision = "20260727_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hotels", sa.Column("hotel_code", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint("uq_hotels_hotel_code", "hotels", ["hotel_code"])
    op.add_column(
        "hotels", sa.Column("service_grade", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "hotels", sa.Column("service_type", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "hotels", sa.Column("default_room_type", sa.String(length=80), nullable=True)
    )
    op.create_table(
        "tour_departure_hotel_prices",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("departure_id", sa.BigInteger(), nullable=False),
        sa.Column("hotel_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "room_type", sa.String(length=80), server_default="Standard", nullable=False
        ),
        sa.Column("service_type", sa.String(length=40), nullable=False),
        sa.Column("double_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("single_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("child_with_bed_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("package_currency", sa.String(length=3), nullable=False),
        sa.Column("child_without_bed_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("child_without_bed_currency", sa.String(length=3), nullable=False),
        sa.Column("infant_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("infant_currency", sa.String(length=3), nullable=False),
        sa.Column("flight_price_per_person", sa.Numeric(16, 2), nullable=False),
        sa.Column("flight_currency", sa.String(length=3), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("double_price >= 0", name="chk_tdhp_double_price"),
        sa.CheckConstraint("single_price >= 0", name="chk_tdhp_single_price"),
        sa.CheckConstraint(
            "child_with_bed_price >= 0", name="chk_tdhp_child_with_bed_price"
        ),
        sa.CheckConstraint(
            "child_without_bed_price >= 0", name="chk_tdhp_child_without_bed_price"
        ),
        sa.CheckConstraint("infant_price >= 0", name="chk_tdhp_infant_price"),
        sa.CheckConstraint(
            "flight_price_per_person >= 0", name="chk_tdhp_flight_price"
        ),
        sa.ForeignKeyConstraint(
            ["departure_id"], ["tour_departures.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "departure_id",
            "hotel_id",
            "room_type",
            "service_type",
            name="uq_tdhp_departure_hotel_offer",
        ),
    )
    op.create_index(
        "idx_tdhp_departure_order",
        "tour_departure_hotel_prices",
        ["departure_id", "display_order"],
    )
    op.create_index("idx_tdhp_hotel", "tour_departure_hotel_prices", ["hotel_id"])


def downgrade() -> None:
    op.drop_index("idx_tdhp_hotel", table_name="tour_departure_hotel_prices")
    op.drop_index("idx_tdhp_departure_order", table_name="tour_departure_hotel_prices")
    op.drop_table("tour_departure_hotel_prices")
    op.drop_column("hotels", "default_room_type")
    op.drop_column("hotels", "service_type")
    op.drop_column("hotels", "service_grade")
    op.drop_constraint("uq_hotels_hotel_code", "hotels", type_="unique")
    op.drop_column("hotels", "hotel_code")
