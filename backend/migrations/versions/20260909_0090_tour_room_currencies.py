"""Preserve the currency of each imported room price independently."""

import sqlalchemy as sa
from alembic import op

revision = "20260909_0090"
down_revision = "20260908_0089"
branch_labels = None
depends_on = None

TABLE = "tour_departure_hotel_prices"
COLUMNS = ("double_currency", "single_currency", "child_with_bed_currency")


def upgrade() -> None:
    # NULL keeps legacy rows using their existing package_currency.
    for column in COLUMNS:
        op.add_column(TABLE, sa.Column(column, sa.String(3), nullable=True))


def downgrade() -> None:
    # Old versions cannot represent mixed currencies without changing prices.
    for column in COLUMNS:
        if op.get_bind().scalar(
            sa.text(
                f"SELECT count(*) FROM {TABLE} "
                f"WHERE {column} IS NOT NULL AND {column} <> package_currency"
            )
        ):
            raise RuntimeError("Cannot downgrade while per-room currencies differ")
    for column in reversed(COLUMNS):
        op.drop_column(TABLE, column)
