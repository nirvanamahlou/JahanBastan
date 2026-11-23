"""cascade dependent hotel pricing on hard deletes

Revision ID: 20260730_0037
Revises: 20260730_0036
Create Date: 2026-07-30
"""

from alembic import op

revision = "20260730_0037"
down_revision = "20260730_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "tour_departure_hotel_prices_hotel_id_fkey",
        "tour_departure_hotel_prices",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tour_departure_hotel_prices_hotel_id_fkey",
        "tour_departure_hotel_prices",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "tour_hotel_packages_hotel_id_fkey",
        "tour_hotel_packages",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tour_hotel_packages_hotel_id_fkey",
        "tour_hotel_packages",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "tour_hotel_packages_hotel_id_fkey",
        "tour_hotel_packages",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tour_hotel_packages_hotel_id_fkey",
        "tour_hotel_packages",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_constraint(
        "tour_departure_hotel_prices_hotel_id_fkey",
        "tour_departure_hotel_prices",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tour_departure_hotel_prices_hotel_id_fkey",
        "tour_departure_hotel_prices",
        "hotels",
        ["hotel_id"],
        ["id"],
        ondelete="RESTRICT",
    )
