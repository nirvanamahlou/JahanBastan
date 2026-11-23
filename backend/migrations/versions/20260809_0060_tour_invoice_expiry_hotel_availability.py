"""Add tour invoice expiry and per-departure hotel availability."""

import sqlalchemy as sa
from alembic import op

revision = "20260809_0060"
down_revision = "20260809_0059"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking_requests",
        sa.Column("payment_expires_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "idx_booking_requests_payment_expiry",
        "booking_requests",
        ["status", "payment_expires_at"],
    )
    op.drop_constraint("chk_booking_requests_status", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_status",
        "booking_requests",
        "status IN ('pending_review', 'approved', 'rejected', 'expired', 'paid')",
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column(
            "is_available", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("tour_departure_hotel_prices", "is_available")
    op.drop_constraint("chk_booking_requests_status", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_status",
        "booking_requests",
        "status IN ('pending_review', 'approved', 'rejected', 'paid')",
    )
    op.drop_index("idx_booking_requests_payment_expiry", table_name="booking_requests")
    op.drop_column("booking_requests", "payment_expires_at")
