"""Add approval-based customer booking requests and immutable line items."""

import sqlalchemy as sa
from alembic import op

revision = "20260801_0041"
down_revision = "20260801_0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "booking_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("booking_number", sa.String(length=40), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default=sa.text("'pending_review'"),
            nullable=False,
        ),
        sa.Column("total_amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("customer_note", sa.Text(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending_review', 'approved', 'rejected', 'paid')",
            name="chk_booking_requests_status",
        ),
        sa.CheckConstraint("total_amount > 0", name="chk_booking_requests_total"),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer_users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_admin_id"], ["admin_users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_number"),
    )
    op.create_index(
        "idx_booking_requests_customer_created",
        "booking_requests",
        ["customer_id", "created_at"],
    )
    op.create_index(
        "idx_booking_requests_status_created",
        "booking_requests",
        ["status", "created_at"],
    )
    op.create_table(
        "booking_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("booking_id", sa.BigInteger(), nullable=False),
        sa.Column("item_type", sa.String(length=16), nullable=False),
        sa.Column("source_cart_item_id", sa.BigInteger(), nullable=True),
        sa.Column("tour_id", sa.BigInteger(), nullable=True),
        sa.Column("travel_service_id", sa.BigInteger(), nullable=True),
        sa.Column("tour_departure_id", sa.BigInteger(), nullable=True),
        sa.Column("hotel_package_id", sa.BigInteger(), nullable=True),
        sa.Column("title_snapshot", sa.String(length=180), nullable=False),
        sa.Column("details_snapshot", sa.String(length=300), nullable=True),
        sa.Column("price_amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.CheckConstraint("price_amount > 0", name="chk_booking_items_price"),
        sa.CheckConstraint(
            "item_type IN ('tour', 'flight')", name="chk_booking_items_type"
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["booking_requests.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_booking_items_booking", "booking_items", ["booking_id", "id"])


def downgrade() -> None:
    op.drop_index("idx_booking_items_booking", table_name="booking_items")
    op.drop_table("booking_items")
    op.drop_index("idx_booking_requests_status_created", table_name="booking_requests")
    op.drop_index(
        "idx_booking_requests_customer_created", table_name="booking_requests"
    )
    op.drop_table("booking_requests")
