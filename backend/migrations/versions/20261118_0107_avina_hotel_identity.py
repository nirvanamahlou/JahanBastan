"""Keep the Avina identification code independent of the city numbering sequence."""

import sqlalchemy as sa
from alembic import op

revision = "20261118_0107"
down_revision = "20261118_merge_ayt_avina"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hotels", sa.Column("avina_identification_code", sa.String(160)))
    op.add_column("hotels", sa.Column("avina_profile", sa.JSON()))
    op.create_unique_constraint(
        "uq_hotels_avina_identification_code", "hotels", ["avina_identification_code"]
    )


def downgrade() -> None:
    op.drop_column("hotels", "avina_profile")
    op.drop_column("hotels", "avina_identification_code")
