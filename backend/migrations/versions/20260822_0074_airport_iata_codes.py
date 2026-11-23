"""Add editable three-letter airport codes to tours and flights."""

import sqlalchemy as sa
from alembic import op

revision = "20260822_0074"
down_revision = "20260822_0073"
branch_labels = None
depends_on = None


TOUR_TABLE = "crm_tour_cache"
TOUR_COLUMNS = (
    "origin_airport_code",
    "destination_airport_code",
    "return_origin_airport_code",
    "return_destination_airport_code",
)
SERVICE_COLUMNS = (
    "origin_airport_code",
    "destination_airport_code",
)


def _constraint_name(table: str, column: str) -> str:
    return f"chk_{table}_{column}_iata"


def upgrade() -> None:
    for column in TOUR_COLUMNS:
        op.add_column(TOUR_TABLE, sa.Column(column, sa.String(length=3), nullable=True))
        op.create_check_constraint(
            _constraint_name(TOUR_TABLE, column),
            TOUR_TABLE,
            f"{column} IS NULL OR {column} ~ '^[A-Z]{{3}}$'",
        )

    for column in SERVICE_COLUMNS:
        op.add_column(
            "travel_services",
            sa.Column(column, sa.String(length=3), nullable=True),
        )
        op.create_check_constraint(
            _constraint_name("travel_services", column),
            "travel_services",
            f"{column} IS NULL OR {column} ~ '^[A-Z]{{3}}$'",
        )


def downgrade() -> None:
    for column in reversed(SERVICE_COLUMNS):
        op.drop_constraint(
            _constraint_name("travel_services", column),
            "travel_services",
            type_="check",
        )
        op.drop_column("travel_services", column)

    for column in reversed(TOUR_COLUMNS):
        op.drop_constraint(
            _constraint_name(TOUR_TABLE, column),
            TOUR_TABLE,
            type_="check",
        )
        op.drop_column(TOUR_TABLE, column)
