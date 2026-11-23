"""Add passenger pet details and customer travel insurance policies."""

import sqlalchemy as sa
from alembic import op

revision = "20260822_0073"
down_revision = "20260817_0072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_passengers",
        sa.Column(
            "has_pet", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("pet_name", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("pet_type", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "customer_passengers",
        sa.Column("pet_weight_kg", sa.Numeric(5, 2), nullable=True),
    )
    op.create_check_constraint(
        "chk_customer_passengers_pet_weight",
        "customer_passengers",
        "pet_weight_kg IS NULL OR (pet_weight_kg > 0 AND pet_weight_kg <= 100)",
    )

    op.create_table(
        "customer_insurances",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("policy_number", sa.String(length=80), nullable=False),
        sa.Column("coverage_title", sa.String(length=160), nullable=False),
        sa.Column("coverage_amount", sa.Numeric(16, 2), nullable=True),
        sa.Column(
            "currency", sa.String(length=3), server_default="IRT", nullable=False
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="active", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'pending', 'expired', 'cancelled')",
            name="chk_customer_insurances_status",
        ),
        sa.CheckConstraint(
            "coverage_amount IS NULL OR coverage_amount >= 0",
            name="chk_customer_insurances_coverage",
        ),
        sa.CheckConstraint(
            "end_date >= start_date",
            name="chk_customer_insurances_dates",
        ),
    )
    op.create_index(
        "idx_customer_insurances_customer_dates",
        "customer_insurances",
        ["customer_id", "end_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_customer_insurances_customer_dates",
        table_name="customer_insurances",
    )
    op.drop_table("customer_insurances")
    op.drop_constraint(
        "chk_customer_passengers_pet_weight",
        "customer_passengers",
        type_="check",
    )
    op.drop_column("customer_passengers", "pet_weight_kg")
    op.drop_column("customer_passengers", "pet_type")
    op.drop_column("customer_passengers", "pet_name")
    op.drop_column("customer_passengers", "has_pet")
