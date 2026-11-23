"""Add father name to reusable passenger identities."""

import sqlalchemy as sa
from alembic import op

revision = "20260808_0056"
down_revision = "20260808_0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_passengers",
        sa.Column("father_name", sa.String(length=60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_passengers", "father_name")
