"""Allow moderated customer comments on every public page."""

import sqlalchemy as sa
from alembic import op

revision = "20260921_0097"
down_revision = "20260921_0096"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_reviews", sa.Column("page_path", sa.String(300)))
    op.add_column("product_reviews", sa.Column("page_title", sa.String(180)))
    op.add_column("product_reviews", sa.Column("author_name_snapshot", sa.String(120)))
    op.execute(
        """
        UPDATE product_reviews AS review
        SET author_name_snapshot = customer.full_name
        FROM customer_users AS customer
        WHERE customer.id = review.customer_id
        """
    )
    op.alter_column("product_reviews", "author_name_snapshot", nullable=False)
    op.alter_column("product_reviews", "target_id", nullable=True)
    op.drop_constraint("chk_product_reviews_target", "product_reviews", type_="check")
    op.create_check_constraint(
        "chk_product_reviews_target",
        "product_reviews",
        "target_type IN ('tour', 'hotel', 'page')",
    )
    op.create_check_constraint(
        "chk_product_reviews_target_reference",
        "product_reviews",
        "(target_type = 'page' AND target_id IS NULL AND page_path IS NOT NULL) "
        "OR (target_type IN ('tour', 'hotel') AND target_id IS NOT NULL "
        "AND page_path IS NULL)",
    )
    op.create_index(
        "uq_product_reviews_customer_page",
        "product_reviews",
        ["customer_id", "page_path"],
        unique=True,
        postgresql_where=sa.text("target_type = 'page'"),
    )


def downgrade() -> None:
    op.execute("DELETE FROM product_reviews WHERE target_type = 'page'")
    op.drop_index("uq_product_reviews_customer_page", table_name="product_reviews")
    op.drop_constraint(
        "chk_product_reviews_target_reference", "product_reviews", type_="check"
    )
    op.drop_constraint("chk_product_reviews_target", "product_reviews", type_="check")
    op.create_check_constraint(
        "chk_product_reviews_target",
        "product_reviews",
        "target_type IN ('tour', 'hotel')",
    )
    op.alter_column("product_reviews", "target_id", nullable=False)
    op.drop_column("product_reviews", "author_name_snapshot")
    op.drop_column("product_reviews", "page_title")
    op.drop_column("product_reviews", "page_path")
