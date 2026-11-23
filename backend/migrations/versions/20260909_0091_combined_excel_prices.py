"""Keep imported combined-package prices independent for every departure."""

import sqlalchemy as sa
from alembic import op

revision = "20260909_0091"
down_revision = "20260909_0090"
branch_labels = None
depends_on = None

TABLE = "tour_combined_departure_prices"
FIELDS = (
    "double",
    "single",
    "child_with_bed",
    "child_without_bed",
    "infant",
    "regular_flight",
    "child_with_bed_flight",
)


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "package_id",
            sa.BigInteger(),
            sa.ForeignKey("tour_combined_packages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "departure_id",
            sa.BigInteger(),
            sa.ForeignKey("tour_departures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        *(
            column
            for field in FIELDS
            for column in (
                sa.Column(f"{field}_price", sa.Numeric(16, 2), nullable=True),
                sa.Column(
                    f"{field}_currency",
                    sa.String(3),
                    nullable=False,
                    server_default=sa.text("'IRT'"),
                ),
            )
        ),
        *(
            sa.CheckConstraint(
                f"{field}_price IS NULL OR {field}_price >= 0",
                name=f"chk_combined_date_{field}",
            )
            for field in FIELDS
        ),
        sa.UniqueConstraint(
            "package_id", "departure_id", name="uq_combined_departure_price"
        ),
    )
    op.create_index(
        "ix_tour_combined_departure_prices_departure_id", TABLE, ["departure_id"]
    )


def downgrade() -> None:
    if op.get_bind().scalar(sa.text(f"SELECT EXISTS (SELECT 1 FROM {TABLE})")):
        raise RuntimeError("Export combined departure prices before downgrading")
    op.drop_table(TABLE)
