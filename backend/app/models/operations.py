"""Internal, provider-independent commercial operations models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.content import TimestampMixin


class CustomerLead(TimestampMixin, Base):
    """A locally managed quote or sales lead, independent of an external CRM."""

    __tablename__ = "customer_leads"
    __table_args__ = (
        CheckConstraint(
            (
                "status IN ('new', 'contacted', 'qualified', "
                "'proposal_sent', 'won', 'lost')"
            ),
            name="chk_customer_leads_status",
        ),
        CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="chk_customer_leads_priority",
        ),
        Index("idx_customer_leads_status_follow_up", "status", "next_follow_up_at"),
        Index("idx_customer_leads_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_users.id", ondelete="SET NULL")
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="SET NULL")
    )
    assigned_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    source: Mapped[str] = mapped_column(String(40), server_default=text("'quote'"))
    subject: Mapped[str] = mapped_column(String(180), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    contact_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    contact_email: Mapped[str | None] = mapped_column(String(254))
    status: Mapped[str] = mapped_column(String(24), server_default=text("'new'"))
    priority: Mapped[str] = mapped_column(String(16), server_default=text("'normal'"))
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRT'"))
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activities: Mapped[list[LeadActivity]] = relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadActivity.created_at.desc()",
        lazy="raise",
    )


class LeadActivity(Base):
    """An immutable, auditable note or status change associated with a lead."""

    __tablename__ = "lead_activities"
    __table_args__ = (
        Index("idx_lead_activities_lead_created", "lead_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("customer_leads.id", ondelete="CASCADE"), nullable=False
    )
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    lead: Mapped[CustomerLead] = relationship(back_populates="activities", lazy="raise")


class CancellationRequest(TimestampMixin, Base):
    """A customer request to cancel a booking, reviewed entirely in-house."""

    __tablename__ = "cancellation_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested', 'in_review', 'approved', 'rejected', 'completed')",
            name="chk_cancellation_requests_status",
        ),
        UniqueConstraint("booking_id", name="uq_cancellation_requests_booking"),
        Index("idx_cancellation_requests_status_created", "status", "created_at"),
        Index(
            "idx_cancellation_requests_customer_created", "customer_id", "created_at"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), server_default=text("'requested'"))
    resolution_note: Mapped[str | None] = mapped_column(Text)
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    refund_status: Mapped[str] = mapped_column(
        String(24), server_default=text("'not_required'"), nullable=False
    )
    refund_reference: Mapped[str | None] = mapped_column(String(80), unique=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NewsletterSubscriber(TimestampMixin, Base):
    """Consent-based internal newsletter list; delivery may be added later."""

    __tablename__ = "newsletter_subscribers"
    __table_args__ = (
        Index("idx_newsletter_subscribers_active", "is_active", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    consent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class DiscountCode(TimestampMixin, Base):
    """An internal promotion rule evaluated before a booking is submitted."""

    __tablename__ = "discount_codes"
    __table_args__ = (
        CheckConstraint(
            "discount_type IN ('fixed', 'percentage')", name="chk_discount_codes_type"
        ),
        CheckConstraint("amount > 0", name="chk_discount_codes_amount"),
        CheckConstraint(
            "max_uses IS NULL OR max_uses > 0", name="chk_discount_codes_max_uses"
        ),
        CheckConstraint(
            "percentage_limit IS NULL OR percentage_limit BETWEEN 1 AND 100",
            name="chk_discount_codes_percentage_limit",
        ),
        Index("idx_discount_codes_active_dates", "is_active", "starts_at", "ends_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    percentage_limit: Mapped[int | None] = mapped_column(Integer)
    max_uses: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    minimum_order_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    applies_to: Mapped[dict[str, str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )


class ProductReview(TimestampMixin, Base):
    """Moderated customer review for a catalog item or public site page."""

    __tablename__ = "product_reviews"
    __table_args__ = (
        CheckConstraint(
            "target_type IN ('tour', 'hotel', 'page')",
            name="chk_product_reviews_target",
        ),
        CheckConstraint(
            "(target_type = 'page' AND target_id IS NULL AND page_path IS NOT NULL) "
            "OR (target_type IN ('tour', 'hotel') AND target_id IS NOT NULL "
            "AND page_path IS NULL)",
            name="chk_product_reviews_target_reference",
        ),
        CheckConstraint("rating BETWEEN 1 AND 5", name="chk_product_reviews_rating"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_product_reviews_status",
        ),
        UniqueConstraint(
            "customer_id",
            "target_type",
            "target_id",
            name="uq_product_reviews_customer_target",
        ),
        Index(
            "idx_product_reviews_public",
            "target_type",
            "target_id",
            "status",
            "created_at",
        ),
        Index(
            "uq_product_reviews_customer_page",
            "customer_id",
            "page_path",
            unique=True,
            postgresql_where=text("target_type = 'page'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    moderated_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_id: Mapped[int | None] = mapped_column(BigInteger)
    page_path: Mapped[str | None] = mapped_column(String(300))
    page_title: Mapped[str | None] = mapped_column(String(180))
    author_name_snapshot: Mapped[str] = mapped_column(String(120), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), server_default=text("'pending'"))
    moderation_note: Mapped[str | None] = mapped_column(Text)
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CustomerNotification(TimestampMixin, Base):
    """An in-product notification, so no external sender is required."""

    __tablename__ = "customer_notifications"
    __table_args__ = (
        Index(
            "idx_customer_notifications_unread", "customer_id", "is_read", "created_at"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(String(300))
    is_read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
