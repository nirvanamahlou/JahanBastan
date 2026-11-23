"""Checkout documents, installment schedules, and audit models."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.content import TimestampMixin


class BookingDocumentRequirement(TimestampMixin, Base):
    """Administrator-managed document rule for checkout fulfilment."""

    __tablename__ = "booking_document_requirements"
    __table_args__ = (
        CheckConstraint(
            "category IN ('identity', 'travel', 'visa', 'installment', "
            "'payment', 'other')",
            name="chk_booking_document_requirements_category",
        ),
        CheckConstraint(
            "applies_to IN ('all', 'tour', 'flight', 'train', 'bus', 'installment')",
            name="chk_booking_document_requirements_applies_to",
        ),
        CheckConstraint("max_bytes > 0", name="chk_booking_document_requirements_size"),
        Index(
            "idx_booking_document_requirements_active",
            "applies_to",
            "display_order",
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(24), nullable=False)
    applies_to: Mapped[str] = mapped_column(String(24), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    allowed_extensions: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text('\'["pdf", "jpg", "jpeg", "png"]\'::jsonb'),
    )
    max_bytes: Mapped[int] = mapped_column(BigInteger, server_default=text("8388608"))
    display_order: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))


class BookingDocument(TimestampMixin, Base):
    """Private booking attachment accessible only to customer and reviewers."""

    __tablename__ = "booking_documents"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_booking_documents_status",
        ),
        CheckConstraint("byte_size > 0", name="chk_booking_documents_size"),
        Index("idx_booking_documents_booking", "booking_id", "created_at"),
        Index("idx_booking_documents_review", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="RESTRICT"), nullable=False
    )
    requirement_id: Mapped[int | None] = mapped_column(
        ForeignKey("booking_document_requirements.id", ondelete="SET NULL")
    )
    passenger_index: Mapped[int | None] = mapped_column(SmallInteger)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'pending'"), nullable=False
    )
    review_note: Mapped[str | None] = mapped_column(String(500))
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BookingInstallment(TimestampMixin, Base):
    """One scheduled installment with mutable settlement status."""

    __tablename__ = "booking_installments"
    __table_args__ = (
        UniqueConstraint(
            "booking_id", "sequence", name="uq_booking_installments_sequence"
        ),
        CheckConstraint("sequence > 0", name="chk_booking_installments_sequence"),
        CheckConstraint("amount > 0", name="chk_booking_installments_amount"),
        CheckConstraint(
            "status IN ('upcoming', 'due', 'paid', 'partial', 'overdue', "
            "'waived', 'rescheduled')",
            name="chk_booking_installments_status",
        ),
        Index("idx_booking_installments_due", "status", "due_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'upcoming'"), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_reference: Mapped[str | None] = mapped_column(String(160))
    admin_note: Mapped[str | None] = mapped_column(String(500))


class BookingStatusEvent(Base):
    """Append-only audit trail for booking and financial changes."""

    __tablename__ = "booking_status_events"
    __table_args__ = (
        Index("idx_booking_status_events_booking", "booking_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(BigInteger)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str | None] = mapped_column(String(32))
    note: Mapped[str | None] = mapped_column(String(500))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
