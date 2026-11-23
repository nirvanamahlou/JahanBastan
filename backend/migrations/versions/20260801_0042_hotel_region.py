"""Add optional region to hotels."""

import sqlalchemy as sa
from alembic import op

revision = "20260801_0042"
down_revision = "20260801_0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hotels",
        sa.Column("region", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hotels", "region")
