"""Store the independent child-with-bed flight rate on ordinary tour offers."""

import sqlalchemy as sa
from alembic import op

revision = "20260911_0092"
down_revision = "20260909_0091"
branch_labels = None
depends_on = None

TABLE = "tour_departure_hotel_prices"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("child_with_bed_flight_price", sa.Numeric(16, 2)))
    op.add_column(
        TABLE,
        sa.Column(
            "child_with_bed_flight_currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'IRT'"),
        ),
    )
    op.create_check_constraint(
        "chk_tdhp_child_flight_price",
        TABLE,
        "child_with_bed_flight_price IS NULL OR child_with_bed_flight_price >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("chk_tdhp_child_flight_price", TABLE, type_="check")
    op.drop_column(TABLE, "child_with_bed_flight_currency")
    op.drop_column(TABLE, "child_with_bed_flight_price")
