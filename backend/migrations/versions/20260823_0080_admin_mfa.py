"""Add encrypted administrator TOTP credentials."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0080"
down_revision = "20260823_0079"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_mfa_credentials",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("admin_user_id", sa.BigInteger(), nullable=False),
        sa.Column("secret_ciphertext", sa.String(512), nullable=False),
        sa.Column(
            "is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("enabled_at", sa.DateTime(timezone=True)),
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
        sa.ForeignKeyConstraint(
            ["admin_user_id"], ["admin_users.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "idx_admin_mfa_credentials_admin_user",
        "admin_mfa_credentials",
        ["admin_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_admin_mfa_credentials_admin_user",
        table_name="admin_mfa_credentials",
    )
    op.drop_table("admin_mfa_credentials")
