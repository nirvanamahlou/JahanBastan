"""Add named multi-hotel packages with separate flight pricing.

Revision ID: 20260901_0085
Revises: 20260901_0084
Create Date: 2026-09-01
"""

import sqlalchemy as sa
from alembic import op

revision = "20260901_0085"
down_revision = "20260901_0084"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tour_combined_packages",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "tour_id",
            sa.BigInteger(),
            sa.ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("double_price", sa.Numeric(16, 2)),
        sa.Column(
            "double_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("single_price", sa.Numeric(16, 2)),
        sa.Column(
            "single_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("child_with_bed_price", sa.Numeric(16, 2)),
        sa.Column(
            "child_with_bed_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("child_without_bed_price", sa.Numeric(16, 2)),
        sa.Column(
            "child_without_bed_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("infant_price", sa.Numeric(16, 2)),
        sa.Column(
            "infant_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("regular_flight_price", sa.Numeric(16, 2)),
        sa.Column(
            "regular_flight_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column("child_without_bed_flight_price", sa.Numeric(16, 2)),
        sa.Column(
            "child_without_bed_flight_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
        sa.Column(
            "add_flight_to_double",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "add_flight_to_single",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "add_flight_to_child_with_bed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "add_flight_to_child_without_bed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "add_flight_to_infant",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "double_price IS NULL OR double_price >= 0",
            name="chk_tour_combined_double_price",
        ),
        sa.CheckConstraint(
            "single_price IS NULL OR single_price >= 0",
            name="chk_tour_combined_single_price",
        ),
        sa.CheckConstraint(
            "child_with_bed_price IS NULL OR child_with_bed_price >= 0",
            name="chk_tour_combined_child_with_bed_price",
        ),
        sa.CheckConstraint(
            "child_without_bed_price IS NULL OR child_without_bed_price >= 0",
            name="chk_tour_combined_child_without_bed_price",
        ),
        sa.CheckConstraint(
            "infant_price IS NULL OR infant_price >= 0",
            name="chk_tour_combined_infant_price",
        ),
        sa.CheckConstraint(
            "regular_flight_price IS NULL OR regular_flight_price >= 0",
            name="chk_tour_combined_regular_flight_price",
        ),
        sa.CheckConstraint(
            "child_without_bed_flight_price IS NULL "
            "OR child_without_bed_flight_price >= 0",
            name="chk_tour_combined_child_flight_price",
        ),
        sa.UniqueConstraint(
            "tour_id",
            "display_order",
            name="uq_tour_combined_package_order",
        ),
    )
    op.create_index(
        "idx_tour_combined_package_tour",
        "tour_combined_packages",
        ["tour_id"],
    )
    op.create_table(
        "tour_combined_package_hotels",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "combined_package_id",
            sa.BigInteger(),
            sa.ForeignKey("tour_combined_packages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "hotel_id",
            sa.BigInteger(),
            sa.ForeignKey("hotels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nights", sa.SmallInteger(), nullable=False),
        sa.Column("board_type", sa.String(40)),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "nights > 0",
            name="chk_tour_combined_hotel_nights",
        ),
        sa.UniqueConstraint(
            "combined_package_id",
            "hotel_id",
            name="uq_tour_combined_package_hotel",
        ),
    )
    op.create_index(
        "idx_tour_combined_package_hotel_package",
        "tour_combined_package_hotels",
        ["combined_package_id"],
    )
    op.create_index(
        "idx_tour_combined_package_hotel_hotel",
        "tour_combined_package_hotels",
        ["hotel_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_tour_combined_package_hotel_hotel",
        table_name="tour_combined_package_hotels",
    )
    op.drop_index(
        "idx_tour_combined_package_hotel_package",
        table_name="tour_combined_package_hotels",
    )
    op.drop_table("tour_combined_package_hotels")
    op.drop_index(
        "idx_tour_combined_package_tour",
        table_name="tour_combined_packages",
    )
    op.drop_table("tour_combined_packages")
