"""Add the public installment availability switch to tours."""

import sqlalchemy as sa
from alembic import op

revision = "20260808_0050"
down_revision = "20260802_0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "is_installment_available",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_crm_tour_cache_installments",
        "crm_tour_cache",
        ["departure_date", "id"],
        postgresql_where=sa.text(
            "availability_status = 'available' AND is_installment_available = true"
        ),
    )


def downgrade() -> None:
    op.drop_index("idx_crm_tour_cache_installments", table_name="crm_tour_cache")
    op.drop_column("crm_tour_cache", "is_installment_available")
