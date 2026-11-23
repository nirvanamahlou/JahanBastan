"""Store optional extra-bed prices for combined tour packages."""

import sqlalchemy as sa
from alembic import op

revision = "20260921_0096"
down_revision = "20260919_0095"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("tour_combined_packages", "tour_combined_departure_prices"):
        op.add_column(table, sa.Column("extra_price", sa.Numeric(16, 2)))
        op.add_column(
            table,
            sa.Column(
                "extra_currency",
                sa.String(3),
                nullable=False,
                server_default="IRT",
            ),
        )
        op.create_check_constraint(
            f"chk_{table}_extra_price",
            table,
            "extra_price IS NULL OR extra_price >= 0",
        )


def downgrade() -> None:
    for table in ("tour_combined_departure_prices", "tour_combined_packages"):
        op.drop_constraint(f"chk_{table}_extra_price", table, type_="check")
        op.drop_column(table, "extra_currency")
        op.drop_column(table, "extra_price")
