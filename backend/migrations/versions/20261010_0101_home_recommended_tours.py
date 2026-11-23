"""Allow editors to select homepage tour recommendations independently."""

import sqlalchemy as sa
from alembic import op

revision = "20261010_0101"
down_revision = "20261010_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "is_home_recommended",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("crm_tour_cache", "is_home_recommended")
