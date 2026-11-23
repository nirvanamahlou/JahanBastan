"""Add managed exchange rates and immutable booking rate snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0079"
down_revision = "20260823_0078"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exchange_rates",
        sa.Column("id", sa.SmallInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("rate_toman", sa.Numeric(14, 0), nullable=False),
        sa.Column("updated_by_admin_id", sa.BigInteger()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.CheckConstraint(
            "currency_code IN ('USD', 'EUR')", name="chk_exchange_rates_code"
        ),
        sa.CheckConstraint("rate_toman > 0", name="chk_exchange_rates_positive"),
        sa.ForeignKeyConstraint(
            ["updated_by_admin_id"], ["admin_users.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("currency_code"),
    )
    op.add_column(
        "bulk_price_adjustments",
        sa.Column("calculation", sa.String(16), nullable=False, server_default="fixed"),
    )
    op.add_column(
        "bulk_price_adjustments",
        sa.Column(
            "selection_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "bulk_price_adjustments",
        sa.Column(
            "price_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "booking_requests",
        sa.Column(
            "exchange_rates_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute("""
        INSERT INTO exchange_rates (currency_code, rate_toman)
        SELECT 'USD', NULLIF(social_links ->> 'exchangeRateUsdIrt', '')::numeric
        FROM site_settings WHERE id = 1 AND COALESCE(social_links ->> 'exchangeRateUsdIrt', '') ~ '^[0-9]+$'
        ON CONFLICT (currency_code) DO NOTHING
    """)
    op.execute("""
        INSERT INTO exchange_rates (currency_code, rate_toman)
        SELECT 'EUR', NULLIF(social_links ->> 'exchangeRateEurIrt', '')::numeric
        FROM site_settings WHERE id = 1 AND COALESCE(social_links ->> 'exchangeRateEurIrt', '') ~ '^[0-9]+$'
        ON CONFLICT (currency_code) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_column("booking_requests", "exchange_rates_snapshot")
    op.drop_column("bulk_price_adjustments", "price_fields")
    op.drop_column("bulk_price_adjustments", "selection_snapshot")
    op.drop_column("bulk_price_adjustments", "calculation")
    op.drop_table("exchange_rates")
