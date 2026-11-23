"""Add bestseller flag to travel services."""

import sqlalchemy as sa
from alembic import op

revision = "20260728_0027"
down_revision = "20260728_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "travel_services",
        sa.Column(
            "is_featured",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "idx_travel_services_featured",
        "travel_services",
        ["display_order", "id"],
        postgresql_where=sa.text("status = 'published' AND is_featured = true"),
    )


def downgrade() -> None:
    op.drop_index("idx_travel_services_featured", table_name="travel_services")
    op.drop_column("travel_services", "is_featured")
