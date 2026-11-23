"""Add the public installment availability switch to destinations."""

import sqlalchemy as sa
from alembic import op

revision = "20260808_0053"
down_revision = "20260808_0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "destinations",
        sa.Column(
            "is_installment_available",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("destinations", "is_installment_available")
