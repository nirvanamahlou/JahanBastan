"""Add independent airline logo media IDs for tour flight legs."""

import sqlalchemy as sa
from alembic import op

revision = "20260809_0062"
down_revision = "20260809_0061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column("airline_logo_image_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column("return_airline_logo_image_id", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("crm_tour_cache", "return_airline_logo_image_id")
    op.drop_column("crm_tour_cache", "airline_logo_image_id")
