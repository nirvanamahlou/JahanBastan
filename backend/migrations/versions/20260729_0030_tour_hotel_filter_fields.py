"""Add hotel guest ratings and tour-package capacities for hotel filtering."""

import sqlalchemy as sa
from alembic import op

revision = "20260729_0030"
down_revision = "20260729_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hotels", sa.Column("guest_rating", sa.String(length=20), nullable=True)
    )
    op.create_check_constraint(
        "chk_hotels_guest_rating",
        "hotels",
        "guest_rating IS NULL OR guest_rating IN ('excellent', 'good', 'average')",
    )
    op.add_column(
        "tour_hotel_packages",
        sa.Column("max_adults", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "tour_hotel_packages",
        sa.Column("max_children", sa.SmallInteger(), nullable=True),
    )
    op.create_check_constraint(
        "chk_tour_hotel_package_max_adults",
        "tour_hotel_packages",
        "max_adults IS NULL OR max_adults > 0",
    )
    op.create_check_constraint(
        "chk_tour_hotel_package_max_children",
        "tour_hotel_packages",
        "max_children IS NULL OR max_children >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "chk_tour_hotel_package_max_children", "tour_hotel_packages", type_="check"
    )
    op.drop_constraint(
        "chk_tour_hotel_package_max_adults", "tour_hotel_packages", type_="check"
    )
    op.drop_column("tour_hotel_packages", "max_children")
    op.drop_column("tour_hotel_packages", "max_adults")
    op.drop_constraint("chk_hotels_guest_rating", "hotels", type_="check")
    op.drop_column("hotels", "guest_rating")
