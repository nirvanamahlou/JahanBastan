"""Add structured traveler profile fields to customer passengers."""

import sqlalchemy as sa
from alembic import op

revision = "20260802_0049"
down_revision = "20260802_0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_passengers",
        sa.Column("first_name", sa.String(length=60), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("last_name", sa.String(length=60), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("first_name_en", sa.String(length=60), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("last_name_en", sa.String(length=60), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("passport_expiry_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "customer_passengers", sa.Column("email", sa.String(length=254), nullable=True)
    )
    op.add_column(
        "customer_passengers",
        sa.Column(
            "gender",
            sa.String(length=16),
            server_default=sa.text("'unspecified'"),
            nullable=False,
        ),
    )
    op.add_column(
        "customer_passengers", sa.Column("age", sa.SmallInteger(), nullable=True)
    )
    op.create_check_constraint(
        "chk_customer_passengers_gender",
        "customer_passengers",
        "gender IN ('male', 'female', 'unspecified')",
    )
    op.create_check_constraint(
        "chk_customer_passengers_age",
        "customer_passengers",
        "age IS NULL OR (age >= 0 AND age <= 120)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_customer_passengers_age", "customer_passengers", type_="check"
    )
    op.drop_constraint(
        "chk_customer_passengers_gender", "customer_passengers", type_="check"
    )
    op.drop_column("customer_passengers", "age")
    op.drop_column("customer_passengers", "gender")
    op.drop_column("customer_passengers", "email")
    op.drop_column("customer_passengers", "passport_expiry_date")
    op.drop_column("customer_passengers", "last_name_en")
    op.drop_column("customer_passengers", "first_name_en")
    op.drop_column("customer_passengers", "last_name")
    op.drop_column("customer_passengers", "first_name")
