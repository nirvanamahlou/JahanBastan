"""Add revocable admin sessions and login lockout state.

Revision ID: 20260723_0002
Revises: 20260723_0001
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260723_0002"
down_revision: str | None = "20260723_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add persistent sessions and account lockout state."""
    op.add_column(
        "admin_users",
        sa.Column(
            "failed_login_count",
            sa.SmallInteger(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "admin_users",
        sa.Column("locked_until", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "admin_sessions",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("admin_user_id", sa.BigInteger(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["admin_user_id"],
            ["admin_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_admin_sessions_token_hash",
        "admin_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "idx_admin_sessions_expiry",
        "admin_sessions",
        ["expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    """Remove session and lockout persistence."""
    op.drop_table("admin_sessions")
    op.drop_column("admin_users", "locked_until")
    op.drop_column("admin_users", "failed_login_count")
