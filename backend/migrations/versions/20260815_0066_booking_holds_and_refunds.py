"""Track completed refunds and make cancellation a terminal booking state."""

import sqlalchemy as sa
from alembic import op

revision = "20260815_0066"
down_revision = "20260815_0065"
branch_labels = None
depends_on = None


BOOKING_STATUS_CHECK = (
    "status IN ('pending_review', 'approved', 'rejected', 'expired', 'paid', "
    "'cancelled')"
)


def upgrade() -> None:
    op.add_column(
        "payment_intents",
        sa.Column(
            "refunded_amount",
            sa.Numeric(14, 0),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.execute("ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_refunded'")
    op.execute("ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded'")

    op.add_column(
        "cancellation_requests",
        sa.Column(
            "refund_status",
            sa.String(length=24),
            server_default=sa.text("'not_required'"),
            nullable=False,
        ),
    )
    op.add_column(
        "cancellation_requests",
        sa.Column("refund_reference", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "cancellation_requests",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_cancellation_requests_refund_reference",
        "cancellation_requests",
        ["refund_reference"],
    )

    op.drop_constraint("chk_booking_requests_status", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_status", "booking_requests", BOOKING_STATUS_CHECK
    )


def downgrade() -> None:
    op.drop_constraint("chk_booking_requests_status", "booking_requests", type_="check")
    op.create_check_constraint(
        "chk_booking_requests_status",
        "booking_requests",
        "status IN ('pending_review', 'approved', 'rejected', 'expired', 'paid')",
    )

    op.drop_constraint(
        "uq_cancellation_requests_refund_reference",
        "cancellation_requests",
        type_="unique",
    )
    op.drop_column("cancellation_requests", "refunded_at")
    op.drop_column("cancellation_requests", "refund_reference")
    op.drop_column("cancellation_requests", "refund_status")
    op.drop_column("payment_intents", "refunded_amount")

    # PostgreSQL enums cannot remove individual values. Recreate the type while
    # mapping refund states back to paid so the downgrade remains executable.
    op.execute(
        "UPDATE payment_intents SET status = 'paid' "
        "WHERE status IN ('partially_refunded', 'refunded')"
    )
    op.execute("ALTER TABLE payment_intents ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE payment_intents ALTER COLUMN status TYPE varchar(32) "
        "USING status::text"
    )
    op.execute("DROP TYPE payment_status")
    op.execute(
        "CREATE TYPE payment_status AS ENUM "
        "('pending', 'gateway_pending', 'paid', 'failed', "
        "'crm_sync_pending', 'crm_synced')"
    )
    op.execute(
        "ALTER TABLE payment_intents ALTER COLUMN status TYPE payment_status "
        "USING status::payment_status"
    )
    op.execute(
        "ALTER TABLE payment_intents ALTER COLUMN status "
        "SET DEFAULT 'pending'::payment_status"
    )
