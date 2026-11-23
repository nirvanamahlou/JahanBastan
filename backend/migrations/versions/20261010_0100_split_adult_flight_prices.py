"""Separate double and single occupancy flight overrides."""

import sqlalchemy as sa
from alembic import op

revision = "20261010_0100"
down_revision = "20260922_0099"
branch_labels = None
depends_on = None
TABLES = (
    "tour_departure_hotel_prices",
    "tour_combined_packages",
    "tour_combined_departure_prices",
)


def upgrade() -> None:
    for table in TABLES:
        for field in ("double_flight_price", "single_flight_price"):
            op.add_column(table, sa.Column(field, sa.Numeric(16, 2), nullable=True))
            op.create_check_constraint(
                f"chk_{table}_{field}", table, f"{field} IS NULL OR {field} >= 0"
            )


def downgrade() -> None:
    for table in reversed(TABLES):
        for field in ("single_flight_price", "double_flight_price"):
            op.drop_constraint(f"chk_{table}_{field}", table, type_="check")
            op.drop_column(table, field)
