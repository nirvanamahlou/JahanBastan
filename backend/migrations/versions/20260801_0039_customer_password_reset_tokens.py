"""Add single-use password reset tokens for customer accounts.

Revision ID: 20260801_0039
Revises: 20260730_0038
"""

import sqlalchemy as sa
from alembic import op

revision = "20260801_0039"
down_revision = "20260730_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_password_reset_tokens",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "customer_user_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_customer_password_reset_tokens_hash",
        "customer_password_reset_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "idx_customer_password_reset_tokens_active",
        "customer_password_reset_tokens",
        ["customer_user_id", "expires_at"],
        postgresql_where=sa.text("used_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "idx_customer_password_reset_tokens_active",
        table_name="customer_password_reset_tokens",
    )
    op.drop_index(
        "idx_customer_password_reset_tokens_hash",
        table_name="customer_password_reset_tokens",
    )
    op.drop_table("customer_password_reset_tokens")
