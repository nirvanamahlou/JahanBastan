"""Allow train and bus tickets in customer carts."""

from alembic import op

revision = "20260808_0052"
down_revision = "20260808_0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "chk_customer_cart_items_type",
        "customer_cart_items",
        type_="check",
    )
    op.create_check_constraint(
        "chk_customer_cart_items_type",
        "customer_cart_items",
        "item_type IN ('tour', 'flight', 'train', 'bus')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_customer_cart_items_type",
        "customer_cart_items",
        type_="check",
    )
    op.create_check_constraint(
        "chk_customer_cart_items_type",
        "customer_cart_items",
        "item_type IN ('tour', 'flight')",
    )
