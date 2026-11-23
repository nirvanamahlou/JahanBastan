"""Preserve the local component of mixed-currency infant Excel prices."""

import sqlalchemy as sa
from alembic import op

revision = "20261102_0102"
down_revision = "20261010_0101"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour_combined_departure_prices",
        sa.Column("infant_supplement_price", sa.Numeric(16, 2), nullable=True),
    )
    op.add_column(
        "tour_combined_departure_prices",
        sa.Column(
            "infant_supplement_currency",
            sa.String(3),
            nullable=False,
            server_default="IRT",
        ),
    )
    op.create_check_constraint(
        "chk_combined_date_infant_supplement",
        "tour_combined_departure_prices",
        "infant_supplement_price IS NULL OR infant_supplement_price >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_combined_date_infant_supplement",
        "tour_combined_departure_prices",
        type_="check",
    )
    op.drop_column("tour_combined_departure_prices", "infant_supplement_currency")
    op.drop_column("tour_combined_departure_prices", "infant_supplement_price")
