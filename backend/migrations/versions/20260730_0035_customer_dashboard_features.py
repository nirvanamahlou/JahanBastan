"""add customer dashboard profile, wallet, passenger, and support data

Revision ID: 20260730_0035
Revises: 20260730_0034
Create Date: 2026-07-30
"""

import sqlalchemy as sa
from alembic import op

revision = "20260730_0035"
down_revision = "20260730_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customer_users", sa.Column("emergency_phone", sa.String(length=32)))
    op.add_column("customer_users", sa.Column("national_code", sa.String(length=16)))
    op.add_column("customer_users", sa.Column("birth_date", sa.Date()))
    op.add_column("customer_users", sa.Column("bank_iban", sa.String(length=34)))
    op.add_column(
        "customer_users", sa.Column("bank_account_number", sa.String(length=64))
    )
    op.add_column("customer_users", sa.Column("bank_card_last4", sa.String(length=4)))

    op.create_table(
        "customer_wallets",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "available_credit",
            sa.Numeric(14, 0),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default=sa.text("'IRR'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.execute(
        "INSERT INTO customer_wallets (customer_id) "
        "SELECT id FROM customer_users ON CONFLICT (customer_id) DO NOTHING"
    )

    op.create_table(
        "customer_passengers",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("national_code", sa.String(length=16)),
        sa.Column("passport_number", sa.String(length=32)),
        sa.Column("birth_date", sa.Date()),
        sa.Column("phone", sa.String(length=32)),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "length(trim(full_name)) > 1", name="chk_customer_passengers_name"
        ),
    )
    op.create_index(
        "idx_customer_passengers_customer_created",
        "customer_passengers",
        ["customer_id", "created_at"],
    )
    op.create_index(
        "idx_customer_passengers_customer_name",
        "customer_passengers",
        ["customer_id", "full_name"],
    )
    op.create_index(
        "uq_customer_passengers_national_code",
        "customer_passengers",
        ["customer_id", "national_code"],
        unique=True,
        postgresql_where=sa.text("national_code IS NOT NULL"),
    )

    op.create_table(
        "customer_support_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'open'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('open', 'in_progress', 'closed')",
            name="chk_customer_support_request_status",
        ),
    )
    op.create_index(
        "idx_customer_support_requests_customer_created",
        "customer_support_requests",
        ["customer_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_customer_support_requests_customer_created",
        table_name="customer_support_requests",
    )
    op.drop_table("customer_support_requests")
    op.drop_index(
        "uq_customer_passengers_national_code", table_name="customer_passengers"
    )
    op.drop_index(
        "idx_customer_passengers_customer_name", table_name="customer_passengers"
    )
    op.drop_index(
        "idx_customer_passengers_customer_created", table_name="customer_passengers"
    )
    op.drop_table("customer_passengers")
    op.drop_table("customer_wallets")
    op.drop_column("customer_users", "bank_card_last4")
    op.drop_column("customer_users", "bank_account_number")
    op.drop_column("customer_users", "bank_iban")
    op.drop_column("customer_users", "birth_date")
    op.drop_column("customer_users", "national_code")
    op.drop_column("customer_users", "emergency_phone")
