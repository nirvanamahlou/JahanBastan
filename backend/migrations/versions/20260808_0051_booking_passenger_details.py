"""Store passenger snapshots on booking requests."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260808_0051"
down_revision = "20260808_0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking_requests",
        sa.Column(
            "passenger_details",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("booking_requests", "passenger_details")
