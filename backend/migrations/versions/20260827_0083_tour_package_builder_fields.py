"""Add package-builder hotel identifiers and base/combined stay flags."""

import sqlalchemy as sa
from alembic import op

revision = "20260827_0083"
down_revision = "20260823_0082"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_tour_cache",
        sa.Column(
            "is_combined_stay",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column("external_price_code", sa.String(64)),
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column("price_set_code", sa.String(64)),
    )
    op.add_column(
        "tour_departure_hotel_prices",
        sa.Column(
            "is_base_package",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index(
        "idx_tdhp_external_price_code",
        "tour_departure_hotel_prices",
        ["external_price_code"],
    )
    op.create_index(
        "idx_tdhp_price_set_code",
        "tour_departure_hotel_prices",
        ["price_set_code"],
    )
    op.create_index(
        "uq_tdhp_departure_base_package",
        "tour_departure_hotel_prices",
        ["departure_id"],
        unique=True,
        postgresql_where=sa.text("is_base_package"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_tdhp_departure_base_package",
        table_name="tour_departure_hotel_prices",
    )
    op.drop_index("idx_tdhp_price_set_code", table_name="tour_departure_hotel_prices")
    op.drop_index(
        "idx_tdhp_external_price_code", table_name="tour_departure_hotel_prices"
    )
    op.drop_column("tour_departure_hotel_prices", "is_base_package")
    op.drop_column("tour_departure_hotel_prices", "price_set_code")
    op.drop_column("tour_departure_hotel_prices", "external_price_code")
    op.drop_column("crm_tour_cache", "is_combined_stay")
