"""Turn customer support requests into guest-capable chat conversations."""

import sqlalchemy as sa
from alembic import op

revision = "20260801_0043"
down_revision = "20260801_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "customer_support_requests",
        "customer_id",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.add_column(
        "customer_support_requests",
        sa.Column("guest_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "customer_support_requests",
        sa.Column("visitor_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "customer_support_requests",
        sa.Column("visitor_email", sa.String(length=254), nullable=True),
    )
    op.add_column(
        "customer_support_requests",
        sa.Column(
            "source",
            sa.String(length=20),
            server_default=sa.text("'account'"),
            nullable=False,
        ),
    )
    op.add_column(
        "customer_support_requests",
        sa.Column(
            "last_sender",
            sa.String(length=20),
            server_default=sa.text("'customer'"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "chk_customer_support_request_source",
        "customer_support_requests",
        "source IN ('account', 'chatbot')",
    )
    op.create_check_constraint(
        "chk_customer_support_request_last_sender",
        "customer_support_requests",
        "last_sender IN ('customer', 'bot', 'admin')",
    )
    op.create_index(
        "uq_customer_support_requests_guest_token",
        "customer_support_requests",
        ["guest_token_hash"],
        unique=True,
        postgresql_where=sa.text("guest_token_hash IS NOT NULL"),
    )
    op.create_index(
        "idx_customer_support_requests_status_updated",
        "customer_support_requests",
        ["status", "updated_at"],
    )

    op.create_table(
        "support_messages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("support_request_id", sa.BigInteger(), nullable=False),
        sa.Column("sender_type", sa.String(length=20), nullable=False),
        sa.Column("admin_id", sa.BigInteger(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sender_type IN ('customer', 'bot', 'admin')",
            name="chk_support_messages_sender_type",
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 4000",
            name="chk_support_messages_body_length",
        ),
        sa.ForeignKeyConstraint(
            ["support_request_id"],
            ["customer_support_requests.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["admin_id"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_support_messages_request_created",
        "support_messages",
        ["support_request_id", "created_at", "id"],
    )
    op.execute(
        """
        INSERT INTO support_messages
            (support_request_id, sender_type, body, created_at)
        SELECT id, 'customer', message, created_at
        FROM customer_support_requests
        """
    )


def downgrade() -> None:
    op.drop_index("idx_support_messages_request_created", table_name="support_messages")
    op.drop_table("support_messages")
    op.drop_index(
        "idx_customer_support_requests_status_updated",
        table_name="customer_support_requests",
    )
    op.drop_index(
        "uq_customer_support_requests_guest_token",
        table_name="customer_support_requests",
    )
    op.drop_constraint(
        "chk_customer_support_request_last_sender",
        "customer_support_requests",
        type_="check",
    )
    op.drop_constraint(
        "chk_customer_support_request_source",
        "customer_support_requests",
        type_="check",
    )
    op.execute("DELETE FROM customer_support_requests WHERE customer_id IS NULL")
    op.drop_column("customer_support_requests", "last_sender")
    op.drop_column("customer_support_requests", "source")
    op.drop_column("customer_support_requests", "visitor_email")
    op.drop_column("customer_support_requests", "visitor_name")
    op.drop_column("customer_support_requests", "guest_token_hash")
    op.alter_column(
        "customer_support_requests",
        "customer_id",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
