"""Store signed Avina visa profiles as native travel services."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261123_avina_visa_profiles"
down_revision = "20261125_direct_tour_replay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("travel_services", sa.Column("avina_visa_service_id", sa.Uuid()))
    op.add_column(
        "travel_services", sa.Column("avina_visa_profile", postgresql.JSONB())
    )
    op.create_unique_constraint(
        "uq_travel_services_avina_visa_service_id",
        "travel_services",
        ["avina_visa_service_id"],
    )
    op.alter_column(
        "travel_services",
        "display_order",
        type_=sa.Integer(),
        existing_type=sa.SmallInteger(),
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_travel_services_avina_visa_service_id", "travel_services", type_="unique"
    )
    op.drop_column("travel_services", "avina_visa_profile")
    op.drop_column("travel_services", "avina_visa_service_id")
    op.alter_column(
        "travel_services",
        "display_order",
        type_=sa.SmallInteger(),
        existing_type=sa.Integer(),
        postgresql_using="LEAST(display_order, 32767)::smallint",
    )
