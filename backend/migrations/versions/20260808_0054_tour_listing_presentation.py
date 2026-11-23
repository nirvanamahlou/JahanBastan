"""Add tour listing presentation controls."""

import sqlalchemy as sa
from alembic import op

revision = "20260808_0054"
down_revision = "20260808_0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "is_direct_flight",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "is_last_minute",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "crm_tour_cache", sa.Column("badge_label", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "display_order",
            sa.SmallInteger(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "chk_crm_tour_cache_display_order",
        "crm_tour_cache",
        "display_order >= 0",
    )
    op.create_index(
        "idx_crm_tour_cache_public_display",
        "crm_tour_cache",
        ["display_order", "departure_date", "id"],
        postgresql_where=sa.text(
            "availability_status = 'available' AND status = 'published'"
        ),
    )


def downgrade() -> None:
    op.drop_index("idx_crm_tour_cache_public_display", table_name="crm_tour_cache")
    op.drop_constraint(
        "chk_crm_tour_cache_display_order", "crm_tour_cache", type_="check"
    )
    op.drop_column("crm_tour_cache", "display_order")
    op.drop_column("crm_tour_cache", "badge_label")
    op.drop_column("crm_tour_cache", "is_last_minute")
    op.drop_column("crm_tour_cache", "is_direct_flight")
