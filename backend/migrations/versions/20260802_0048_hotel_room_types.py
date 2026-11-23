"""Add independently managed hotel room types and nightly prices."""

import sqlalchemy as sa
from alembic import op

revision = "20260802_0048"
down_revision = "20260802_0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hotel_rooms",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("hotel_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("price_amount", sa.Numeric(precision=14, scale=0), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default=sa.text("'IRT'"),
            nullable=False,
        ),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("display_order >= 0", name="chk_hotel_rooms_display_order"),
        sa.CheckConstraint("price_amount >= 0", name="chk_hotel_rooms_price"),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "name", name="uq_hotel_rooms_name"),
    )
    op.create_index(
        "idx_hotel_rooms_hotel_order",
        "hotel_rooms",
        ["hotel_id", "display_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_hotel_rooms_hotel_order", table_name="hotel_rooms")
    op.drop_table("hotel_rooms")
