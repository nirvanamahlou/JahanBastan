"""Persist short-lived recovery codes for administrative accounts."""

import sqlalchemy as sa
from alembic import op

revision = "20260817_0072"
down_revision = "20260816_0071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_password_reset_codes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "admin_user_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
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
        "idx_admin_password_reset_codes_active",
        "admin_password_reset_codes",
        ["admin_user_id", "expires_at"],
        postgresql_where=sa.text("used_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "idx_admin_password_reset_codes_active",
        table_name="admin_password_reset_codes",
    )
    op.drop_table("admin_password_reset_codes")
