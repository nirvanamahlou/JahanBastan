"""Add internal CRM, moderation, retention and cancellation workflows."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260809_0058"
down_revision = "20260808_0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_leads",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "assigned_admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "source", sa.String(length=40), nullable=False, server_default="quote"
        ),
        sa.Column("subject", sa.String(length=180), nullable=False),
        sa.Column("details", sa.Text()),
        sa.Column("contact_name", sa.String(length=120), nullable=False),
        sa.Column("contact_phone", sa.String(length=32)),
        sa.Column("contact_email", sa.String(length=254)),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="new"),
        sa.Column(
            "priority", sa.String(length=16), nullable=False, server_default="normal"
        ),
        sa.Column("expected_amount", sa.Numeric(precision=14, scale=0)),
        sa.Column(
            "currency", sa.String(length=3), nullable=False, server_default="IRT"
        ),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost')",
            name="chk_customer_leads_status",
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="chk_customer_leads_priority",
        ),
    )
    op.create_index(
        "idx_customer_leads_status_follow_up",
        "customer_leads",
        ["status", "next_follow_up_at"],
    )
    op.create_index(
        "idx_customer_leads_customer_created",
        "customer_leads",
        ["customer_id", "created_at"],
    )
    op.create_table(
        "lead_activities",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "lead_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("activity_type", sa.String(length=32), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_lead_activities_lead_created", "lead_activities", ["lead_id", "created_at"]
    )
    op.create_table(
        "cancellation_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "booking_id",
            sa.BigInteger(),
            sa.ForeignKey("booking_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewed_by_admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(length=24), nullable=False, server_default="requested"
        ),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("refund_amount", sa.Numeric(precision=14, scale=0)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('requested', 'in_review', 'approved', 'rejected', 'completed')",
            name="chk_cancellation_requests_status",
        ),
        sa.UniqueConstraint("booking_id", name="uq_cancellation_requests_booking"),
    )
    op.create_index(
        "idx_cancellation_requests_status_created",
        "cancellation_requests",
        ["status", "created_at"],
    )
    op.create_index(
        "idx_cancellation_requests_customer_created",
        "cancellation_requests",
        ["customer_id", "created_at"],
    )
    op.create_table(
        "newsletter_subscribers",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("email", sa.String(length=254), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=120)),
        sa.Column("phone", sa.String(length=32)),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "consent_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_newsletter_subscribers_active",
        "newsletter_subscribers",
        ["is_active", "created_at"],
    )
    op.create_table(
        "discount_codes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("code", sa.String(length=40), nullable=False, unique=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("discount_type", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=0), nullable=False),
        sa.Column("percentage_limit", sa.Integer()),
        sa.Column("max_uses", sa.Integer()),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minimum_order_amount", sa.Numeric(precision=14, scale=0)),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "applies_to",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "discount_type IN ('fixed', 'percentage')", name="chk_discount_codes_type"
        ),
        sa.CheckConstraint("amount > 0", name="chk_discount_codes_amount"),
        sa.CheckConstraint(
            "max_uses IS NULL OR max_uses > 0", name="chk_discount_codes_max_uses"
        ),
        sa.CheckConstraint(
            "percentage_limit IS NULL OR percentage_limit BETWEEN 1 AND 100",
            name="chk_discount_codes_percentage_limit",
        ),
    )
    op.create_index(
        "idx_discount_codes_active_dates",
        "discount_codes",
        ["is_active", "starts_at", "ends_at"],
    )
    op.create_table(
        "product_reviews",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "moderated_by_admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
        ),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column("target_id", sa.BigInteger(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160)),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="pending"
        ),
        sa.Column("moderation_note", sa.Text()),
        sa.Column("moderated_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "target_type IN ('tour', 'hotel')", name="chk_product_reviews_target"
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="chk_product_reviews_rating"),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_product_reviews_status",
        ),
        sa.UniqueConstraint(
            "customer_id",
            "target_type",
            "target_id",
            name="uq_product_reviews_customer_target",
        ),
    )
    op.create_index(
        "idx_product_reviews_public",
        "product_reviews",
        ["target_type", "target_id", "status", "created_at"],
    )
    op.create_table(
        "customer_notifications",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.BigInteger(),
            sa.ForeignKey("customer_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("notification_type", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link", sa.String(length=300)),
        sa.Column(
            "is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_customer_notifications_unread",
        "customer_notifications",
        ["customer_id", "is_read", "created_at"],
    )


def downgrade() -> None:
    for index, table in (
        ("idx_customer_notifications_unread", "customer_notifications"),
        ("idx_product_reviews_public", "product_reviews"),
        ("idx_discount_codes_active_dates", "discount_codes"),
        ("idx_newsletter_subscribers_active", "newsletter_subscribers"),
        ("idx_cancellation_requests_customer_created", "cancellation_requests"),
        ("idx_cancellation_requests_status_created", "cancellation_requests"),
        ("idx_lead_activities_lead_created", "lead_activities"),
        ("idx_customer_leads_customer_created", "customer_leads"),
        ("idx_customer_leads_status_follow_up", "customer_leads"),
    ):
        op.drop_index(index, table_name=table)
    op.drop_table("customer_notifications")
    op.drop_table("product_reviews")
    op.drop_table("discount_codes")
    op.drop_table("newsletter_subscribers")
    op.drop_table("cancellation_requests")
    op.drop_table("lead_activities")
    op.drop_table("customer_leads")
