"""Persist the discount code applied to a booking snapshot."""

import sqlalchemy as sa
from alembic import op

revision = "20260809_0059"
down_revision = "20260809_0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_requests", sa.Column("discount_code", sa.String(length=40)))
    op.create_index(
        "idx_booking_requests_discount_code", "booking_requests", ["discount_code"]
    )


def downgrade() -> None:
    op.drop_index("idx_booking_requests_discount_code", table_name="booking_requests")
    op.drop_column("booking_requests", "discount_code")
