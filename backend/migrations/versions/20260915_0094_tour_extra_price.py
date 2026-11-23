"""Store optional Extra-bed prices for dated tour hotel offers."""

import sqlalchemy as sa
from alembic import op

revision = "20260915_0094"
down_revision = "20260911_0093"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column("extra_price", sa.Numeric(16, 2), nullable=True),
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column("extra_currency", sa.String(3), nullable=True),
    )
    op.create_check_constraint(
        "chk_tdhp_extra_price",
        "tour_departure_hotel_prices",
        "extra_price IS NULL OR extra_price >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_tdhp_extra_price", "tour_departure_hotel_prices", type_="check"
    )
    op.drop_column("tour_departure_hotel_prices", "extra_currency")
    op.drop_column("tour_departure_hotel_prices", "extra_price")
