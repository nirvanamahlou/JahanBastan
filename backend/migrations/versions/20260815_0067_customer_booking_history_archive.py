"""Allow customers to hide completed bookings from their own history."""

import sqlalchemy as sa
from alembic import op

revision = "20260815_0067"
down_revision = "20260815_0066"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking_requests",
        sa.Column("customer_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_booking_requests_customer_history",
        "booking_requests",
        ["customer_id", "customer_hidden_at", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_booking_requests_customer_history", table_name="booking_requests"
    )
    op.drop_column("booking_requests", "customer_hidden_at")
