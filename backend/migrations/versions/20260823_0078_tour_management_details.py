"""Add advanced tour scheduling and editorial fields."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0078"
down_revision = "20260823_0077"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column in [
        sa.Column("refund_policy", sa.Text()),
        sa.Column("installment_terms", sa.Text()),
        sa.Column("image_alt_text", sa.String(255)),
        sa.Column(
            "flight_included", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "airport_transfer_included",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("flight_price_amount", sa.Numeric(14, 0)),
        sa.Column("flight_price_currency", sa.String(3)),
    ]:
        op.add_column("crm_tour_cache", column)
    for column in [
        sa.Column("stage_type", sa.String(80)),
        sa.Column("duration_minutes", sa.SmallInteger()),
        sa.Column("travel_class", sa.String(80)),
        sa.Column("baggage_allowance_kg", sa.SmallInteger()),
    ]:
        op.add_column("tour_travel_legs", column)

    for column in [
        sa.Column("external_code", sa.String(64)),
        sa.Column("price_set_code", sa.String(64)),
        sa.Column("return_date", sa.Date()),
        sa.Column("capacity_total", sa.SmallInteger()),
        sa.Column("capacity_remaining", sa.SmallInteger()),
        sa.Column(
            "booking_status", sa.String(24), nullable=False, server_default="open"
        ),
        sa.Column("outbound_flight_number", sa.String(32)),
        sa.Column("outbound_departure_time", sa.Time()),
        sa.Column("outbound_arrival_time", sa.Time()),
        sa.Column("return_flight_number", sa.String(32)),
        sa.Column("return_departure_time", sa.Time()),
        sa.Column("return_arrival_time", sa.Time()),
    ]:
        op.add_column("tour_departures", column)
    op.create_index(
        "idx_tour_departures_external_code",
        "tour_departures",
        ["external_code"],
        unique=True,
    )
    op.create_check_constraint(
        "chk_tour_departures_capacity",
        "tour_departures",
        "capacity_total IS NULL OR capacity_total >= 0",
    )
    op.create_check_constraint(
        "chk_tour_departures_remaining",
        "tour_departures",
        "capacity_remaining IS NULL OR capacity_remaining >= 0",
    )
    op.create_check_constraint(
        "chk_tour_departures_status",
        "tour_departures",
        "booking_status IN ('open', 'closed', 'sold_out')",
    )
    op.create_check_constraint(
        "chk_tour_leg_duration",
        "tour_travel_legs",
        "duration_minutes IS NULL OR duration_minutes >= 0",
    )
    op.create_check_constraint(
        "chk_tour_leg_baggage",
        "tour_travel_legs",
        "baggage_allowance_kg IS NULL OR baggage_allowance_kg >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("chk_tour_leg_baggage", "tour_travel_legs", type_="check")
    op.drop_constraint("chk_tour_leg_duration", "tour_travel_legs", type_="check")
    op.drop_constraint("chk_tour_departures_status", "tour_departures", type_="check")
    op.drop_constraint(
        "chk_tour_departures_remaining", "tour_departures", type_="check"
    )
    op.drop_constraint("chk_tour_departures_capacity", "tour_departures", type_="check")
    op.drop_index("idx_tour_departures_external_code", table_name="tour_departures")
    for name in [
        "return_arrival_time",
        "return_departure_time",
        "return_flight_number",
        "outbound_arrival_time",
        "outbound_departure_time",
        "outbound_flight_number",
        "booking_status",
        "capacity_remaining",
        "capacity_total",
        "return_date",
        "price_set_code",
        "external_code",
    ]:
        op.drop_column("tour_departures", name)
    for name in [
        "baggage_allowance_kg",
        "travel_class",
        "duration_minutes",
        "stage_type",
    ]:
        op.drop_column("tour_travel_legs", name)
    for name in [
        "flight_price_currency",
        "flight_price_amount",
        "airport_transfer_included",
        "flight_included",
        "image_alt_text",
        "installment_terms",
        "refund_policy",
    ]:
        op.drop_column("crm_tour_cache", name)
