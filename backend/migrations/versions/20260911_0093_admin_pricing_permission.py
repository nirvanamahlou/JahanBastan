"""Allow explicitly selected admins to manage pricing without super-admin access."""

import sqlalchemy as sa
from alembic import op

revision = "20260911_0093"
down_revision = "20260911_0092"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column(
            "can_manage_pricing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("admin_users", "can_manage_pricing")
