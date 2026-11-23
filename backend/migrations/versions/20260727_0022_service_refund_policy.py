"""Add refund policy to travel services."""

import sqlalchemy as sa
from alembic import op

revision = "20260727_0022"
down_revision = "20260727_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services", sa.Column("refund_policy", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("travel_services", "refund_policy")
