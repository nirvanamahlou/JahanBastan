"""Add an optional sample form link to visa services."""

import sqlalchemy as sa
from alembic import op

revision = "20260919_0095"
down_revision = "20260915_0094"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column("visa_form_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("travel_services", "visa_form_url")
