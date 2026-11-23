"""Store customer transport availability alerts."""

import sqlalchemy as sa
from alembic import op

revision = "20260729_0029"
down_revision = "20260728_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "availability_alerts",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("service_type", sa.String(length=16), nullable=False),
        sa.Column("origin", sa.String(length=120), nullable=False),
        sa.Column("destination", sa.String(length=120), nullable=False),
        sa.Column("departure_date", sa.Date(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "service_type IN ('flight', 'train', 'bus')",
            name="chk_availability_alerts_service_type",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customer_users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "customer_id",
            "service_type",
            "origin",
            "destination",
            "departure_date",
            name="uq_availability_alert_route",
        ),
    )
    op.create_index(
        "idx_availability_alerts_active",
        "availability_alerts",
        ["customer_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("idx_availability_alerts_active", table_name="availability_alerts")
    op.drop_table("availability_alerts")
