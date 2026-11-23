"""Add non-destructive visibility markers for customer and admin history lists."""

import sqlalchemy as sa
from alembic import op

revision = "20260815_0068"
down_revision = "20260815_0067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_users",
        sa.Column("admin_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_customer_users_admin_list",
        "customer_users",
        ["admin_hidden_at", "created_at"],
    )
    op.add_column(
        "customer_carts",
        sa.Column("admin_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_customer_carts_admin_list",
        "customer_carts",
        ["admin_hidden_at", "updated_at"],
    )
    op.add_column(
        "payment_intents",
        sa.Column("customer_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_payment_intents_customer_history",
        "payment_intents",
        ["customer_user_id", "customer_hidden_at", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_payment_intents_customer_history", table_name="payment_intents")
    op.drop_column("payment_intents", "customer_hidden_at")
    op.drop_index("idx_customer_carts_admin_list", table_name="customer_carts")
    op.drop_column("customer_carts", "admin_hidden_at")
    op.drop_index("idx_customer_users_admin_list", table_name="customer_users")
    op.drop_column("customer_users", "admin_hidden_at")
