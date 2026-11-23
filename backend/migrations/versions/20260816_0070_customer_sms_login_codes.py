"""Persist short-lived, one-use SMS login codes for SMS.ir."""

import sqlalchemy as sa
from alembic import op

revision = "20260816_0070"
down_revision = "20260815_0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_sms_login_codes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_customer_sms_login_codes_active",
        "customer_sms_login_codes",
        ["phone", "expires_at"],
        postgresql_where=sa.text("used_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "idx_customer_sms_login_codes_active",
        table_name="customer_sms_login_codes",
    )
    op.drop_table("customer_sms_login_codes")
