"""Add auditable, idempotent wallet top-up records."""

import sqlalchemy as sa
from alembic import op

revision = "20260815_0069"
down_revision = "20260815_0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wallet_topups",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("payment_intent_id", sa.BigInteger(), nullable=False),
        sa.Column("reference", sa.String(length=64), nullable=False),
        sa.Column("amount", sa.Numeric(14, 0), nullable=False),
        sa.Column(
            "currency", sa.String(length=3), server_default="IRR", nullable=False
        ),
        sa.Column(
            "status", sa.String(length=24), server_default="pending", nullable=False
        ),
        sa.Column("credited_at", sa.DateTime(timezone=True), nullable=True),
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
            nullable=True,
        ),
        sa.CheckConstraint("amount > 0", name="chk_wallet_topups_amount"),
        sa.CheckConstraint("currency = 'IRR'", name="chk_wallet_topups_currency"),
        sa.CheckConstraint(
            "status IN ('pending', 'gateway_pending', 'paid', 'failed')",
            name="chk_wallet_topups_status",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer_users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["payment_intent_id"], ["payment_intents.id"], ondelete="RESTRICT"
        ),
        sa.UniqueConstraint(
            "payment_intent_id", name="uq_wallet_topups_payment_intent"
        ),
        sa.UniqueConstraint("reference", name="uq_wallet_topups_reference"),
    )
    op.create_index(
        "idx_wallet_topups_customer_created",
        "wallet_topups",
        ["customer_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_wallet_topups_customer_created", table_name="wallet_topups")
    op.drop_table("wallet_topups")
