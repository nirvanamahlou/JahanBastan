"""Add symmetric tour flights and linked combination destinations."""

import sqlalchemy as sa
from alembic import op

revision = "20260823_0082"
down_revision = "20260823_0081"
branch_labels = None
depends_on = None


TOUR_COLUMNS = [
    sa.Column("arrival_time", sa.Time()),
    sa.Column("baggage_allowance_kg", sa.SmallInteger()),
    sa.Column("aircraft_name", sa.String(120)),
    sa.Column("travel_class", sa.String(80)),
    sa.Column("return_baggage_allowance_kg", sa.SmallInteger()),
    sa.Column("return_aircraft_name", sa.String(120)),
    sa.Column("return_travel_class", sa.String(80)),
]

DEPARTURE_COLUMNS = [
    sa.Column("outbound_airline_name", sa.String(120)),
    sa.Column("outbound_airline_logo_image_id", sa.BigInteger()),
    sa.Column("outbound_origin_airport", sa.String(160)),
    sa.Column("outbound_origin_airport_code", sa.String(3)),
    sa.Column("outbound_destination_airport", sa.String(160)),
    sa.Column("outbound_destination_airport_code", sa.String(3)),
    sa.Column("outbound_baggage_allowance_kg", sa.SmallInteger()),
    sa.Column("outbound_aircraft_name", sa.String(120)),
    sa.Column("outbound_travel_class", sa.String(80)),
    sa.Column("return_airline_name", sa.String(120)),
    sa.Column("return_airline_logo_image_id", sa.BigInteger()),
    sa.Column("return_origin_airport", sa.String(160)),
    sa.Column("return_origin_airport_code", sa.String(3)),
    sa.Column("return_destination_airport", sa.String(160)),
    sa.Column("return_destination_airport_code", sa.String(3)),
    sa.Column("return_baggage_allowance_kg", sa.SmallInteger()),
    sa.Column("return_aircraft_name", sa.String(120)),
    sa.Column("return_travel_class", sa.String(80)),
]


def upgrade() -> None:
    for column in TOUR_COLUMNS:
        op.add_column("crm_tour_cache", column)
    op.create_check_constraint(
        "chk_tour_outbound_baggage",
        "crm_tour_cache",
        "baggage_allowance_kg IS NULL OR baggage_allowance_kg >= 0",
    )
    op.create_check_constraint(
        "chk_tour_return_baggage",
        "crm_tour_cache",
        "return_baggage_allowance_kg IS NULL OR return_baggage_allowance_kg >= 0",
    )

    op.add_column("tour_travel_legs", sa.Column("destination_id", sa.BigInteger()))
    op.add_column("tour_travel_legs", sa.Column("hotel_id", sa.BigInteger()))
    op.add_column("tour_travel_legs", sa.Column("arrival_date", sa.Date()))
    op.add_column("tour_travel_legs", sa.Column("airline_name", sa.String(120)))
    op.add_column("tour_travel_legs", sa.Column("flight_number", sa.String(32)))
    op.add_column("tour_travel_legs", sa.Column("stay_nights", sa.SmallInteger()))
    op.create_foreign_key(
        "fk_tour_travel_legs_destination",
        "tour_travel_legs",
        "destinations",
        ["destination_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tour_travel_legs_hotel",
        "tour_travel_legs",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_tour_travel_legs_destination", "tour_travel_legs", ["destination_id"]
    )
    op.create_index("idx_tour_travel_legs_hotel", "tour_travel_legs", ["hotel_id"])
    op.create_check_constraint(
        "chk_tour_leg_stay_nights",
        "tour_travel_legs",
        "stay_nights IS NULL OR stay_nights > 0",
    )
    op.create_check_constraint(
        "chk_tour_leg_arrival_date",
        "tour_travel_legs",
        "arrival_date IS NULL OR arrival_date >= departure_date",
    )

    for column in DEPARTURE_COLUMNS:
        op.add_column("tour_departures", column)
    op.create_check_constraint(
        "chk_tour_departure_outbound_baggage",
        "tour_departures",
        "outbound_baggage_allowance_kg IS NULL OR outbound_baggage_allowance_kg >= 0",
    )
    op.create_check_constraint(
        "chk_tour_departure_return_baggage",
        "tour_departures",
        "return_baggage_allowance_kg IS NULL OR return_baggage_allowance_kg >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_tour_departure_return_baggage", "tour_departures", type_="check"
    )
    op.drop_constraint(
        "chk_tour_departure_outbound_baggage", "tour_departures", type_="check"
    )
    for column in reversed(DEPARTURE_COLUMNS):
        op.drop_column("tour_departures", column.name)

    op.drop_constraint("chk_tour_leg_arrival_date", "tour_travel_legs", type_="check")
    op.drop_constraint("chk_tour_leg_stay_nights", "tour_travel_legs", type_="check")
    op.drop_index("idx_tour_travel_legs_hotel", table_name="tour_travel_legs")
    op.drop_index("idx_tour_travel_legs_destination", table_name="tour_travel_legs")
    op.drop_constraint(
        "fk_tour_travel_legs_hotel", "tour_travel_legs", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_tour_travel_legs_destination", "tour_travel_legs", type_="foreignkey"
    )
    for name in [
        "stay_nights",
        "flight_number",
        "airline_name",
        "arrival_date",
        "hotel_id",
        "destination_id",
    ]:
        op.drop_column("tour_travel_legs", name)

    op.drop_constraint("chk_tour_return_baggage", "crm_tour_cache", type_="check")
    op.drop_constraint("chk_tour_outbound_baggage", "crm_tour_cache", type_="check")
    for column in reversed(TOUR_COLUMNS):
        op.drop_column("crm_tour_cache", column.name)
