"""add managed night counts to tour departures"""

import sqlalchemy as sa
from alembic import op

revision = "20260730_0036"
down_revision = "20260730_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour_departures", sa.Column("nights", sa.SmallInteger(), nullable=True)
    )
    op.create_check_constraint(
        "chk_departure_nights",
        "tour_departures",
        "nights IS NULL OR nights > 0",
    )


def downgrade() -> None:
    op.drop_constraint("chk_departure_nights", "tour_departures", type_="check")
    op.drop_column("tour_departures", "nights")
