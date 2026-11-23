"""Add agency registration, approval and purchasing credit.

Revision ID: 20260907_0087
Revises: 20260903_0086
Create Date: 2026-09-07
"""

import sqlalchemy as sa
from alembic import op

revision = "20260907_0087"
down_revision = "20260903_0086"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_users",
        sa.Column(
            "account_type",
            sa.String(length=16),
            server_default="customer",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "chk_customer_users_account_type",
        "customer_users",
        "account_type IN ('customer', 'agency')",
    )
    op.add_column(
        "booking_requests",
        sa.Column(
            "agency_credit_reserved_amount",
            sa.Numeric(14, 0),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "booking_requests",
        sa.Column(
            "agency_credit_charged_amount",
            sa.Numeric(14, 0),
            server_default="0",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "chk_booking_requests_agency_credit_reserved",
        "booking_requests",
        "agency_credit_reserved_amount >= 0",
    )
    op.create_check_constraint(
        "chk_booking_requests_agency_credit_charged",
        "booking_requests",
        "agency_credit_charged_amount >= 0",
    )

    op.create_table(
        "agency_profiles",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("legal_name", sa.String(180), nullable=False),
        sa.Column("registration_number", sa.String(64), nullable=False),
        sa.Column("national_id", sa.String(32), nullable=False),
        sa.Column("economic_code", sa.String(32)),
        sa.Column("license_number", sa.String(64), nullable=False),
        sa.Column("manager_name", sa.String(120), nullable=False),
        sa.Column("manager_national_code", sa.String(16), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("province", sa.String(80), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("postal_code", sa.String(20)),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column(
            "credit_limit", sa.Numeric(14, 0), server_default="0", nullable=False
        ),
        sa.Column("credit_used", sa.Numeric(14, 0), server_default="0", nullable=False),
        sa.Column(
            "credit_reserved", sa.Numeric(14, 0), server_default="0", nullable=False
        ),
        sa.Column("currency", sa.String(3), server_default="IRT", nullable=False),
        sa.Column("review_note", sa.Text()),
        sa.Column(
            "reviewed_by_admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_agency_profiles_status",
        ),
        sa.CheckConstraint(
            "credit_limit >= 0", name="chk_agency_profiles_credit_limit"
        ),
        sa.CheckConstraint("credit_used >= 0", name="chk_agency_profiles_credit_used"),
        sa.CheckConstraint(
            "credit_reserved >= 0", name="chk_agency_profiles_credit_reserved"
        ),
        sa.CheckConstraint(
            "credit_used + credit_reserved <= credit_limit",
            name="chk_agency_profiles_credit_balance",
        ),
    )
    op.create_index(
        "idx_agency_profiles_status_created",
        "agency_profiles",
        ["status", "created_at"],
    )
    op.create_table(
        "agency_credit_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "agency_profile_id",
            sa.BigInteger(),
            sa.ForeignKey("agency_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("credit_limit_after", sa.Numeric(14, 0), nullable=False),
        sa.Column("credit_used_after", sa.Numeric(14, 0), nullable=False),
        sa.Column("credit_reserved_after", sa.Numeric(14, 0), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount >= 0", name="chk_agency_credit_events_amount"),
    )
    op.create_index(
        "idx_agency_credit_events_agency_created",
        "agency_credit_events",
        ["agency_profile_id", "created_at"],
    )
    op.create_index(
        "idx_agency_credit_events_booking",
        "agency_credit_events",
        ["booking_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_agency_credit_events_booking", table_name="agency_credit_events")
    op.drop_index(
        "idx_agency_credit_events_agency_created",
        table_name="agency_credit_events",
    )
    op.drop_table("agency_credit_events")
    op.drop_index("idx_agency_profiles_status_created", table_name="agency_profiles")
    op.drop_table("agency_profiles")
    op.drop_constraint(
        "chk_booking_requests_agency_credit_charged",
        "booking_requests",
        type_="check",
    )
    op.drop_constraint(
        "chk_booking_requests_agency_credit_reserved",
        "booking_requests",
        type_="check",
    )
    op.drop_column("booking_requests", "agency_credit_charged_amount")
    op.drop_column("booking_requests", "agency_credit_reserved_amount")
    op.drop_constraint(
        "chk_customer_users_account_type", "customer_users", type_="check"
    )
    op.drop_column("customer_users", "account_type")
