"""Add structured hotel content and seasonal pricing."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0077"
down_revision = "20260823_0076"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hotels", sa.Column("service_category", sa.String(40)))
    op.add_column("hotels", sa.Column("cancellation_policy", sa.Text()))
    op.add_column("hotels", sa.Column("child_with_bed_price", sa.Numeric(14, 0)))
    op.add_column("hotels", sa.Column("child_without_bed_price", sa.Numeric(14, 0)))
    op.add_column("hotels", sa.Column("infant_price", sa.Numeric(14, 0)))
    op.add_column("hotels", sa.Column("city", sa.String(100)))
    op.add_column("hotels", sa.Column("image_alt_text", sa.String(255)))
    op.create_table(
        "hotel_price_periods",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "hotel_id",
            sa.BigInteger(),
            sa.ForeignKey("hotels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("adult_price", sa.Numeric(16, 2), nullable=False),
        sa.Column("child_with_bed_price", sa.Numeric(16, 2)),
        sa.Column("child_without_bed_price", sa.Numeric(16, 2)),
        sa.Column("infant_price", sa.Numeric(16, 2)),
        sa.Column("currency", sa.String(3), server_default="IRT", nullable=False),
        sa.CheckConstraint(
            "start_date <= end_date", name="chk_hotel_price_period_dates"
        ),
        sa.CheckConstraint("adult_price >= 0", name="chk_hotel_price_period_adult"),
        sa.CheckConstraint(
            "child_with_bed_price IS NULL OR child_with_bed_price >= 0",
            name="chk_hotel_price_period_child_with_bed",
        ),
        sa.CheckConstraint(
            "child_without_bed_price IS NULL OR child_without_bed_price >= 0",
            name="chk_hotel_price_period_child_without_bed",
        ),
        sa.CheckConstraint(
            "infant_price IS NULL OR infant_price >= 0",
            name="chk_hotel_price_period_infant",
        ),
        sa.UniqueConstraint(
            "hotel_id", "start_date", "end_date", name="uq_hotel_price_period_dates"
        ),
    )
    op.create_index(
        "idx_hotel_price_period_lookup",
        "hotel_price_periods",
        ["hotel_id", "start_date", "end_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_hotel_price_period_lookup", table_name="hotel_price_periods")
    op.drop_table("hotel_price_periods")
    op.drop_column("hotels", "image_alt_text")
    op.drop_column("hotels", "city")
    op.drop_column("hotels", "infant_price")
    op.drop_column("hotels", "child_without_bed_price")
    op.drop_column("hotels", "child_with_bed_price")
    op.drop_column("hotels", "cancellation_policy")
    op.drop_column("hotels", "service_category")
