"""Deduplicate confirmed direct tour requests per customer."""

import sqlalchemy as sa
from alembic import op

revision = "20261125_direct_tour_replay"
down_revision = "20261122_avina_tour_editorial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_requests", sa.Column("direct_request_key", sa.String(36)))
    op.add_column("booking_requests", sa.Column("direct_request_digest", sa.String(64)))
    op.create_index(
        "uq_booking_direct_request",
        "booking_requests",
        ["customer_id", "direct_request_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_booking_direct_request", table_name="booking_requests")
    op.drop_column("booking_requests", "direct_request_digest")
    op.drop_column("booking_requests", "direct_request_key")
