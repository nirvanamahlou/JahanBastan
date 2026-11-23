"""Add public customer accounts and revocable sessions.

Revision ID: 20260726_0019
Revises: 20260726_0018
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0019"
down_revision = "20260726_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_users",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column(
            "failed_login_count",
            sa.SmallInteger(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
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
        sa.UniqueConstraint("email", name="uq_customer_users_email"),
    )
    op.create_index(
        "idx_customer_users_active",
        "customer_users",
        ["email"],
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_table(
        "customer_sessions",
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
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_customer_sessions_token_hash",
        "customer_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "idx_customer_sessions_expiry",
        "customer_sessions",
        ["expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_customer_sessions_expiry", table_name="customer_sessions")
    op.drop_index("idx_customer_sessions_token_hash", table_name="customer_sessions")
    op.drop_table("customer_sessions")
    op.drop_index("idx_customer_users_active", table_name="customer_users")
    op.drop_table("customer_users")
