"""add payment intent ledger

Revision ID: 20260730_0032
Revises: 20260729_0031
Create Date: 2026-07-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260730_0032"
down_revision = "20260729_0031"
branch_labels = None
depends_on = None

payment_status = postgresql.ENUM(
    "pending",
    "gateway_pending",
    "paid",
    "failed",
    "crm_sync_pending",
    "crm_synced",
    name="payment_status",
    create_type=False,
)


def upgrade() -> None:
    payment_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "payment_intents",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_user_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("crm_contract_number", sa.String(length=128), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=0), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column(
            "status",
            payment_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("provider", sa.String(length=40), nullable=True),
        sa.Column(
            "provider_authority", sa.String(length=160), nullable=True, unique=True
        ),
        sa.Column(
            "provider_reference", sa.String(length=160), nullable=True, unique=True
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "crm_payment_reference", sa.String(length=160), nullable=True, unique=True
        ),
        sa.Column("crm_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(length=300), nullable=True),
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
        sa.CheckConstraint("amount > 0", name="chk_payment_intents_amount"),
    )
    op.create_index(
        "idx_payment_intents_customer_created",
        "payment_intents",
        ["customer_user_id", "created_at"],
    )
    op.create_index(
        "idx_payment_intents_contract_status",
        "payment_intents",
        ["crm_contract_number", "status"],
    )
    op.create_index(
        "idx_payment_intents_crm_sync",
        "payment_intents",
        ["created_at"],
        postgresql_where=sa.text("status = 'crm_sync_pending'"),
    )


def downgrade() -> None:
    op.drop_index("idx_payment_intents_crm_sync", table_name="payment_intents")
    op.drop_index("idx_payment_intents_contract_status", table_name="payment_intents")
    op.drop_index("idx_payment_intents_customer_created", table_name="payment_intents")
    op.drop_table("payment_intents")
    payment_status.drop(op.get_bind(), checkfirst=True)
