"""Add an audit trail for administrative bulk price adjustments."""

import sqlalchemy as sa
from alembic import op

revision = "20260802_0045"
down_revision = "20260801_0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bulk_price_adjustments",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("admin_id", sa.BigInteger(), nullable=False),
        sa.Column("target", sa.String(length=20), nullable=False),
        sa.Column("direction", sa.String(length=12), nullable=False),
        sa.Column("amount_toman", sa.Numeric(14, 0), nullable=False),
        sa.Column("affected_rates", sa.BigInteger(), nullable=False),
        sa.Column("skipped_unpriced", sa.BigInteger(), nullable=False),
        sa.Column("skipped_foreign_currency", sa.BigInteger(), nullable=False),
        sa.Column("before_total_toman", sa.Numeric(20, 2), nullable=False),
        sa.Column("after_total_toman", sa.Numeric(20, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target IN ('flight', 'train', 'bus', 'visa', 'hotel', 'tour', 'all')",
            name="chk_bulk_price_adjustments_target",
        ),
        sa.CheckConstraint(
            "direction IN ('increase', 'decrease')",
            name="chk_bulk_price_adjustments_direction",
        ),
        sa.CheckConstraint(
            "amount_toman > 0",
            name="chk_bulk_price_adjustments_amount",
        ),
        sa.CheckConstraint(
            "affected_rates > 0",
            name="chk_bulk_price_adjustments_affected",
        ),
        sa.ForeignKeyConstraint(["admin_id"], ["admin_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_bulk_price_adjustments_created",
        "bulk_price_adjustments",
        ["created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_bulk_price_adjustments_created",
        table_name="bulk_price_adjustments",
    )
    op.drop_table("bulk_price_adjustments")
