"""add ordered multi-leg routes to tours

Revision ID: 20260730_0033
Revises: 20260730_0032
Create Date: 2026-07-30
"""

import sqlalchemy as sa
from alembic import op

revision = "20260730_0033"
down_revision = "20260730_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tour_travel_legs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "tour_id",
            sa.BigInteger(),
            sa.ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.Column("transportation", sa.String(length=50), nullable=False),
        sa.Column("departure_date", sa.Date(), nullable=False),
        sa.Column("departure_time", sa.Time(), nullable=True),
        sa.Column("arrival_time", sa.Time(), nullable=True),
        sa.Column("origin", sa.String(length=120), nullable=False),
        sa.Column("origin_terminal", sa.String(length=160), nullable=True),
        sa.Column("destination", sa.String(length=120), nullable=False),
        sa.Column("destination_terminal", sa.String(length=160), nullable=True),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 49",
            name="chk_tour_travel_legs_order",
        ),
        sa.UniqueConstraint(
            "tour_id",
            "display_order",
            name="uq_tour_travel_legs_order",
        ),
    )
    op.create_index(
        "idx_tour_travel_legs_tour_order",
        "tour_travel_legs",
        ["tour_id", "display_order"],
    )


def downgrade() -> None:
    op.drop_index("idx_tour_travel_legs_tour_order", table_name="tour_travel_legs")
    op.drop_table("tour_travel_legs")
