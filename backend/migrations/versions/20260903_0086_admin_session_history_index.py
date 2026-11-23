"""Index administrator sessions for newest-first login history.

Revision ID: 20260903_0086
Revises: 20260901_0085
Create Date: 2026-09-03
"""

from alembic import op

revision = "20260903_0086"
down_revision = "20260901_0085"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_admin_sessions_created",
        "admin_sessions",
        ["created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("idx_admin_sessions_created", table_name="admin_sessions")
