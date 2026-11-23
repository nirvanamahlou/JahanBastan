"""Add editable title and description to tour travel legs."""

import sqlalchemy as sa
from alembic import op

revision = "20260822_0075"
down_revision = "20260822_0074"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour_travel_legs",
        sa.Column("title", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "tour_travel_legs",
        sa.Column("description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tour_travel_legs", "description")
    op.drop_column("tour_travel_legs", "title")
