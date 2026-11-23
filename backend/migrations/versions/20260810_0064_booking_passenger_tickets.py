"""Create immutable passenger tickets issued after payment confirmation."""

import sqlalchemy as sa
from alembic import op

revision = "20260810_0064"
down_revision = "20260809_0063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "booking_passenger_tickets",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("booking_id", sa.BigInteger(), nullable=False),
        sa.Column("booking_item_id", sa.BigInteger(), nullable=False),
        sa.Column("passenger_index", sa.SmallInteger(), nullable=False),
        sa.Column("ticket_number", sa.String(length=64), nullable=False),
        sa.Column(
            "passenger_type",
            sa.String(length=16),
            server_default="adult",
            nullable=False,
        ),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("father_name", sa.String(length=120), nullable=True),
        sa.Column("first_name_en", sa.String(length=120), nullable=True),
        sa.Column("last_name_en", sa.String(length=120), nullable=True),
        sa.Column("national_code", sa.String(length=32), nullable=True),
        sa.Column("passport_number", sa.String(length=64), nullable=True),
        sa.Column("item_type", sa.String(length=16), nullable=False),
        sa.Column("service_title", sa.String(length=180), nullable=False),
        sa.Column("route", sa.String(length=300), nullable=False),
        sa.Column("departure_airport", sa.String(length=160), nullable=True),
        sa.Column("arrival_airport", sa.String(length=160), nullable=True),
        sa.Column("departure_date", sa.Date(), nullable=True),
        sa.Column("departure_time", sa.Time(), nullable=True),
        sa.Column("carrier", sa.String(length=160), nullable=True),
        sa.Column("travel_class", sa.String(length=120), nullable=True),
        sa.Column("baggage_allowance", sa.String(length=120), nullable=True),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "passenger_index >= 0", name="chk_booking_ticket_passenger_index"
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["booking_requests.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["booking_item_id"], ["booking_items.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ticket_number", name="uq_booking_passenger_tickets_number"
        ),
        sa.UniqueConstraint(
            "booking_id",
            "booking_item_id",
            "passenger_index",
            name="uq_booking_ticket_passenger_item",
        ),
    )
    op.create_index(
        "idx_booking_passenger_tickets_booking",
        "booking_passenger_tickets",
        ["booking_id", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_booking_passenger_tickets_booking",
        table_name="booking_passenger_tickets",
    )
    op.drop_table("booking_passenger_tickets")
