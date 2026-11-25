"""Core website and CRM projection models."""

from __future__ import annotations

import enum
from datetime import date, datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.auth import AdminSession, CustomerSession
    from app.models.combined_pricing import TourCombinedDeparturePrice


class PublicationStatus(enum.StrEnum):
    """Editorial publication lifecycle."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


publication_status_enum = Enum(
    PublicationStatus,
    name="publication_status",
    values_callable=lambda values: [item.value for item in values],
)


class TimestampMixin:
    """Database-managed creation and update timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        onupdate=text("now()"),
    )


class PaymentStatus(enum.StrEnum):
    """Lifecycle of a payment attempt; only verified payments may settle CRM debt."""

    PENDING = "pending"
    GATEWAY_PENDING = "gateway_pending"
    PAID = "paid"
    FAILED = "failed"
    CRM_SYNC_PENDING = "crm_sync_pending"
    CRM_SYNCED = "crm_synced"
    PARTIALLY_REFUNDED = "partially_refunded"
    REFUNDED = "refunded"


payment_status_enum = Enum(
    PaymentStatus,
    name="payment_status",
    values_callable=lambda values: [item.value for item in values],
)


class BookingStatus(enum.StrEnum):
    """Approval lifecycle for a cart converted to a booking request."""

    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentIntent(TimestampMixin, Base):
    """Immutable financial attempt linked to one customer and CRM contract."""

    __tablename__ = "payment_intents"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_payment_intents_amount"),
        Index(
            "idx_payment_intents_customer_created",
            "customer_user_id",
            "created_at",
        ),
        Index(
            "idx_payment_intents_contract_status",
            "crm_contract_number",
            "status",
        ),
        Index(
            "idx_payment_intents_crm_sync",
            "created_at",
            postgresql_where=text("status = 'crm_sync_pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )
    customer_user_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    crm_contract_number: Mapped[str] = mapped_column(String(128), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        payment_status_enum,
        server_default=text("'pending'"),
    )
    provider: Mapped[str | None] = mapped_column(String(40))
    provider_authority: Mapped[str | None] = mapped_column(
        String(160),
        unique=True,
    )
    provider_reference: Mapped[str | None] = mapped_column(String(160), unique=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    crm_payment_reference: Mapped[str | None] = mapped_column(
        String(160),
        unique=True,
    )
    crm_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(String(300))
    refunded_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    # Customer-facing history marker; financial records remain retained for accounting.
    customer_hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Country(TimestampMixin, Base):
    """A CMS-managed country used to classify destinations."""

    __tablename__ = "countries"
    __table_args__ = (
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_countries_publication_time",
        ),
        Index(
            "idx_countries_published_order",
            "display_order",
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    internal_note: Mapped[str | None] = mapped_column(Text)
    image_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gallery: Mapped[list[CountryImage]] = relationship(
        back_populates="country",
        cascade="all, delete-orphan",
        order_by="CountryImage.display_order",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        return [item.image_id for item in self.gallery]


class CountryImage(Base):
    __tablename__ = "country_images"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 5", name="chk_country_images_order"
        ),
        UniqueConstraint("country_id", "image_id", name="uq_country_images_image"),
        UniqueConstraint("country_id", "display_order", name="uq_country_images_order"),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    country_id: Mapped[int] = mapped_column(
        ForeignKey("countries.id", ondelete="CASCADE")
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)
    country: Mapped[Country] = relationship(back_populates="gallery", lazy="raise")


class MediaAsset(Base):
    """Validated image metadata; binary content lives outside PostgreSQL."""

    __tablename__ = "media_assets"
    __table_args__ = (CheckConstraint("byte_size > 0", name="chk_media_assets_size"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()
    alt_text: Mapped[str] = mapped_column(String(255), server_default=text("''"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class ArticleCategory(Base):
    """A small managed taxonomy used by published articles."""

    __tablename__ = "article_categories"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    internal_note: Mapped[str | None] = mapped_column(Text)


class SiteSetting(TimestampMixin, Base):
    """Singleton public website settings."""

    __tablename__ = "site_settings"
    __table_args__ = (CheckConstraint("id = 1", name="chk_site_settings_singleton"),)

    id: Mapped[int] = mapped_column(
        SmallInteger, primary_key=True, server_default=text("1")
    )
    site_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(254))
    address: Mapped[str | None] = mapped_column(Text)
    working_hours: Mapped[str | None] = mapped_column(String(160))
    social_links: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text("'{}'::jsonb"),
    )
    internal_note: Mapped[str | None] = mapped_column(Text)


class AdminUser(TimestampMixin, Base):
    """Administrative account containing only a password hash."""

    __tablename__ = "admin_users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('super_admin', 'admin', 'editor')",
            name="chk_admin_users_role",
        ),
        Index(
            "idx_admin_users_active",
            "email",
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), server_default=text("'editor'"))
    can_manage_pricing: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_login_count: Mapped[int] = mapped_column(
        SmallInteger, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list[AdminSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class ExchangeRate(TimestampMixin, Base):
    """Current manually managed exchange rate with administrator metadata."""

    __tablename__ = "exchange_rates"
    __table_args__ = (
        CheckConstraint(
            "currency_code IN ('USD', 'EUR')", name="chk_exchange_rates_code"
        ),
        CheckConstraint("rate_toman > 0", name="chk_exchange_rates_positive"),
    )

    id: Mapped[int] = mapped_column(
        SmallInteger, Identity(always=True), primary_key=True
    )
    currency_code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    rate_toman: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    updated_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )


class BulkPriceAdjustment(Base):
    """Immutable audit entry for one successful bulk rate change."""

    __tablename__ = "bulk_price_adjustments"
    __table_args__ = (
        CheckConstraint(
            "target IN ('flight', 'train', 'bus', 'visa', 'hotel', 'tour', 'all')",
            name="chk_bulk_price_adjustments_target",
        ),
        CheckConstraint(
            "direction IN ('increase', 'decrease')",
            name="chk_bulk_price_adjustments_direction",
        ),
        CheckConstraint(
            "amount_toman > 0",
            name="chk_bulk_price_adjustments_amount",
        ),
        CheckConstraint(
            "affected_rates > 0",
            name="chk_bulk_price_adjustments_affected",
        ),
        Index(
            "idx_bulk_price_adjustments_created",
            "created_at",
            "id",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    target: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(12), nullable=False)
    calculation: Mapped[str] = mapped_column(
        String(16), server_default=text("'fixed'"), nullable=False
    )
    selection_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text("'{}'::jsonb"),
        nullable=False,
    )
    price_fields: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text("'[]'::jsonb"),
        nullable=False,
    )
    amount_toman: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    affected_rates: Mapped[int] = mapped_column(BigInteger, nullable=False)
    skipped_unpriced: Mapped[int] = mapped_column(BigInteger, nullable=False)
    skipped_foreign_currency: Mapped[int] = mapped_column(BigInteger, nullable=False)
    before_total_toman: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    after_total_toman: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class CustomerUser(TimestampMixin, Base):
    """Public customer account, isolated from administrative authorization."""

    __tablename__ = "customer_users"
    __table_args__ = (
        CheckConstraint(
            "account_type IN ('customer', 'agency')",
            name="chk_customer_users_account_type",
        ),
        Index(
            "idx_customer_users_active",
            "email",
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(
        String(16), server_default=text("'customer'"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_login_count: Mapped[int] = mapped_column(
        SmallInteger, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Administrative list marker. Hiding an account never deletes or disables it.
    admin_hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list[CustomerSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    cart_items: Mapped[list[CartItem]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    carts: Mapped[list[CustomerCart]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    saved_tours: Mapped[list[SavedTour]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    phone: Mapped[str | None] = mapped_column(String(32))
    emergency_phone: Mapped[str | None] = mapped_column(String(32))
    buyer_mobile: Mapped[str | None] = mapped_column(String(32))
    landline: Mapped[str | None] = mapped_column(String(32))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    national_code: Mapped[str | None] = mapped_column(String(16))
    birth_date: Mapped[date | None] = mapped_column(Date)
    address: Mapped[str | None] = mapped_column(Text)
    bank_iban: Mapped[str | None] = mapped_column(String(34))
    bank_account_number: Mapped[str | None] = mapped_column(String(64))
    bank_card_last4: Mapped[str | None] = mapped_column(String(4))
    wallet: Mapped[CustomerWallet | None] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="raise",
    )
    agency_profile: Mapped[AgencyProfile | None] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="raise",
    )
    passengers: Mapped[list[CustomerPassenger]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", lazy="raise"
    )
    insurances: Mapped[list[CustomerInsurance]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", lazy="raise"
    )
    support_requests: Mapped[list[CustomerSupportRequest]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", lazy="raise"
    )

    booking_requests: Mapped[list[BookingRequest]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", lazy="raise"
    )


class CustomerCart(TimestampMixin, Base):
    """A recoverable travel cart, kept separate from the booking request."""

    __tablename__ = "customer_carts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'abandoned', 'converted', 'expired', 'cancelled')",
            name="chk_customer_carts_status",
        ),
        Index(
            "idx_customer_carts_customer_status", "customer_id", "status", "updated_at"
        ),
        Index(
            "uq_customer_carts_active_customer",
            "customer_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'active'"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRT'"))
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    converted_booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="SET NULL")
    )
    assigned_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    # Administrative list marker; the customer cart and its audit trail are retained.
    admin_hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer: Mapped[CustomerUser] = relationship(back_populates="carts", lazy="raise")
    items: Mapped[list[CartItem]] = relationship(
        back_populates="cart", cascade="all, delete-orphan", lazy="raise"
    )
    events: Mapped[list[CartEvent]] = relationship(
        back_populates="cart",
        cascade="all, delete-orphan",
        order_by="CartEvent.created_at.desc()",
        lazy="raise",
    )


class CartEvent(Base):
    """Append-only audit event for cart activity and operational follow-up."""

    __tablename__ = "cart_events"
    __table_args__ = (
        Index("idx_cart_events_cart_created", "cart_id", "created_at"),
        Index("idx_cart_events_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    cart_id: Mapped[int] = mapped_column(
        ForeignKey("customer_carts.id", ondelete="CASCADE"), nullable=False
    )
    cart_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_cart_items.id", ondelete="SET NULL")
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(BigInteger)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    cart: Mapped[CustomerCart] = relationship(back_populates="events", lazy="raise")


class CartItem(TimestampMixin, Base):
    """A customer-owned, price-snapshotted tour or transport selection."""

    __tablename__ = "customer_cart_items"
    __table_args__ = (
        CheckConstraint(
            "item_type IN ('tour', 'flight', 'train', 'bus')",
            name="chk_customer_cart_items_type",
        ),
        CheckConstraint(
            "(tour_id IS NOT NULL AND travel_service_id IS NULL) OR "
            "(tour_id IS NULL AND travel_service_id IS NOT NULL)",
            name="chk_customer_cart_items_source",
        ),
        Index("idx_customer_cart_items_customer_updated", "customer_id", "updated_at"),
        Index("idx_customer_cart_items_cart_status", "cart_id", "status", "updated_at"),
        Index(
            "uq_customer_cart_items_tour_selection",
            "cart_id",
            "tour_departure_id",
            "tour_hotel_price_id",
            unique=True,
            postgresql_where=text(
                "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL "
                "AND tour_hotel_price_id IS NOT NULL"
            ),
        ),
        Index(
            "uq_customer_cart_items_flight",
            "cart_id",
            "travel_service_id",
            unique=True,
            postgresql_where=text("travel_service_id IS NOT NULL"),
        ),
        Index(
            "uq_customer_cart_items_combined_selection",
            "cart_id",
            "tour_departure_id",
            "combined_departure_price_id",
            unique=True,
            postgresql_where=text(
                "tour_id IS NOT NULL AND tour_departure_id IS NOT NULL "
                "AND combined_departure_price_id IS NOT NULL"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    cart_id: Mapped[int] = mapped_column(
        ForeignKey("customer_carts.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), server_default=text("'active'"), nullable=False
    )
    price_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    item_type: Mapped[str] = mapped_column(String(16), nullable=False)
    tour_id: Mapped[int | None] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    travel_service_id: Mapped[int | None] = mapped_column(
        ForeignKey("travel_services.id", ondelete="CASCADE")
    )
    tour_departure_id: Mapped[int | None] = mapped_column(
        ForeignKey("tour_departures.id", ondelete="CASCADE")
    )
    hotel_package_id: Mapped[int | None] = mapped_column(
        ForeignKey("tour_hotel_packages.id", ondelete="CASCADE")
    )
    tour_hotel_price_id: Mapped[int | None] = mapped_column(
        ForeignKey("tour_departure_hotel_prices.id", ondelete="CASCADE")
    )
    combined_departure_price_id: Mapped[int | None] = mapped_column(
        ForeignKey("tour_combined_departure_prices.id", ondelete="CASCADE")
    )
    room_selection: Mapped[dict[str, int]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )
    hotel_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    hotel_currency: Mapped[str | None] = mapped_column(String(3))
    flight_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    flight_currency: Mapped[str | None] = mapped_column(String(3))
    title_snapshot: Mapped[str] = mapped_column(String(180), nullable=False)
    details_snapshot: Mapped[str | None] = mapped_column(String(300))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str | None] = mapped_column(String(3))
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    current_price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    current_currency: Mapped[str | None] = mapped_column(String(3))
    current_hotel_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    current_hotel_currency: Mapped[str | None] = mapped_column(String(3))
    current_flight_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    current_flight_currency: Mapped[str | None] = mapped_column(String(3))
    product_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )

    customer: Mapped[CustomerUser] = relationship(
        back_populates="cart_items", lazy="raise"
    )
    cart: Mapped[CustomerCart] = relationship(back_populates="items", lazy="raise")
    tour: Mapped[Tour | None] = relationship(lazy="raise")
    travel_service: Mapped[TravelService | None] = relationship(lazy="raise")
    tour_departure: Mapped[TourDeparture | None] = relationship(lazy="raise")
    hotel_package: Mapped[TourHotelPackage | None] = relationship(lazy="raise")
    tour_hotel_price: Mapped[TourDepartureHotelPrice | None] = relationship(
        lazy="raise"
    )
    combined_departure_price: Mapped[TourCombinedDeparturePrice | None] = relationship(
        lazy="raise"
    )


class BookingRequest(TimestampMixin, Base):
    """Immutable cart snapshot awaiting an administrator decision."""

    __tablename__ = "booking_requests"
    __table_args__ = (
        CheckConstraint(
            (
                "status IN ('pending_review', 'approved', 'rejected', 'expired', "
                "'paid', 'cancelled')"
            ),
            name="chk_booking_requests_status",
        ),
        CheckConstraint(
            "total_amount IS NULL OR total_amount > 0",
            name="chk_booking_requests_total",
        ),
        CheckConstraint(
            "agency_credit_reserved_amount >= 0",
            name="chk_booking_requests_agency_credit_reserved",
        ),
        CheckConstraint(
            "agency_credit_charged_amount >= 0",
            name="chk_booking_requests_agency_credit_charged",
        ),
        Index(
            "uq_booking_direct_request",
            "customer_id",
            "direct_request_key",
            unique=True,
        ),
        Index("idx_booking_requests_customer_created", "customer_id", "created_at"),
        Index("idx_booking_requests_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    direct_request_key: Mapped[str | None] = mapped_column(String(36))
    direct_request_digest: Mapped[str | None] = mapped_column(String(64))
    booking_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), server_default=text("'pending_review'"), nullable=False
    )
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    customer_note: Mapped[str | None] = mapped_column(Text)
    exchange_rates_snapshot: Mapped[dict[str, str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text("'{}'::jsonb"),
        nullable=False,
    )
    passenger_details: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        server_default=text("'[]'::jsonb"),
        nullable=False,
    )
    admin_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    capacity_reserved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    capacity_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Customer-only archive marker; support and accounting keep the full record.
    customer_hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_method: Mapped[str] = mapped_column(
        String(16), server_default=text("'cash'"), nullable=False
    )
    agency_credit_reserved_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    agency_credit_charged_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    checkout_step: Mapped[str] = mapped_column(
        String(32), server_default=text("'review'"), nullable=False
    )
    terms_version: Mapped[str | None] = mapped_column(String(40))
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    discount_code: Mapped[str | None] = mapped_column(String(40))

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    service_fee_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    payable_now_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    installment_months: Mapped[int | None] = mapped_column(SmallInteger)
    installment_down_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    installment_fee_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    installment_financed_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    installment_total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    installment_monthly_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    installment_first_due_date: Mapped[date | None] = mapped_column(Date)
    installment_status: Mapped[str | None] = mapped_column(String(32))
    guarantor_details: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )

    customer: Mapped[CustomerUser] = relationship(
        back_populates="booking_requests", lazy="raise"
    )
    reviewed_by: Mapped[AdminUser | None] = relationship(lazy="raise")
    items: Mapped[list[BookingItem]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingItem.id",
        lazy="raise",
    )
    tickets: Mapped[list[BookingPassengerTicket]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingPassengerTicket.id",
        lazy="raise",
    )


class BookingItem(Base):
    """Immutable price and description snapshot belonging to a booking request."""

    __tablename__ = "booking_items"
    __table_args__ = (
        CheckConstraint(
            "price_amount IS NULL OR price_amount > 0",
            name="chk_booking_items_price",
        ),
        CheckConstraint(
            "item_type IN ('tour', 'flight', 'train', 'bus')",
            name="chk_booking_items_type",
        ),
        Index("idx_booking_items_booking", "booking_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_cart_item_id: Mapped[int | None] = mapped_column(BigInteger)
    tour_id: Mapped[int | None] = mapped_column(BigInteger)
    travel_service_id: Mapped[int | None] = mapped_column(BigInteger)
    tour_departure_id: Mapped[int | None] = mapped_column(BigInteger)
    hotel_package_id: Mapped[int | None] = mapped_column(BigInteger)
    tour_hotel_price_id: Mapped[int | None] = mapped_column(BigInteger)
    combined_departure_price_id: Mapped[int | None] = mapped_column(BigInteger)
    room_selection: Mapped[dict[str, int]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), server_default=text("'{}'::jsonb")
    )
    hotel_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    hotel_currency: Mapped[str | None] = mapped_column(String(3))
    flight_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    flight_currency: Mapped[str | None] = mapped_column(String(3))
    title_snapshot: Mapped[str] = mapped_column(String(180), nullable=False)
    details_snapshot: Mapped[str | None] = mapped_column(String(300))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str | None] = mapped_column(String(3))

    booking: Mapped[BookingRequest] = relationship(back_populates="items", lazy="raise")
    tickets: Mapped[list[BookingPassengerTicket]] = relationship(
        back_populates="booking_item",
        cascade="all, delete-orphan",
        order_by="BookingPassengerTicket.id",
        lazy="raise",
    )


class BookingPassengerTicket(TimestampMixin, Base):
    """Immutable travel-ticket data for one passenger and order item."""

    __tablename__ = "booking_passenger_tickets"
    __table_args__ = (
        CheckConstraint(
            "passenger_index >= 0", name="chk_booking_ticket_passenger_index"
        ),
        UniqueConstraint("ticket_number", name="uq_booking_passenger_tickets_number"),
        UniqueConstraint(
            "booking_id",
            "booking_item_id",
            "passenger_index",
            name="uq_booking_ticket_passenger_item",
        ),
        Index("idx_booking_passenger_tickets_booking", "booking_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="CASCADE"), nullable=False
    )
    booking_item_id: Mapped[int] = mapped_column(
        ForeignKey("booking_items.id", ondelete="CASCADE"), nullable=False
    )
    passenger_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    ticket_number: Mapped[str] = mapped_column(String(64), nullable=False)
    passenger_type: Mapped[str] = mapped_column(
        String(16), server_default=text("'adult'"), nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    father_name: Mapped[str | None] = mapped_column(String(120))
    first_name_en: Mapped[str | None] = mapped_column(String(120))
    last_name_en: Mapped[str | None] = mapped_column(String(120))
    national_code: Mapped[str | None] = mapped_column(String(32))
    passport_number: Mapped[str | None] = mapped_column(String(64))
    item_type: Mapped[str] = mapped_column(String(16), nullable=False)
    service_title: Mapped[str] = mapped_column(String(180), nullable=False)
    route: Mapped[str] = mapped_column(String(300), nullable=False)
    departure_airport: Mapped[str | None] = mapped_column(String(160))
    arrival_airport: Mapped[str | None] = mapped_column(String(160))
    departure_date: Mapped[date | None] = mapped_column(Date)
    departure_time: Mapped[time | None] = mapped_column(Time)
    carrier: Mapped[str | None] = mapped_column(String(160))
    travel_class: Mapped[str | None] = mapped_column(String(120))
    baggage_allowance: Mapped[str | None] = mapped_column(String(120))
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    booking: Mapped[BookingRequest] = relationship(
        back_populates="tickets", lazy="raise"
    )
    booking_item: Mapped[BookingItem] = relationship(
        back_populates="tickets", lazy="raise"
    )


class SavedTour(TimestampMixin, Base):
    """A customer-specific favorite, always bound to a real tour."""

    __tablename__ = "customer_saved_tours"
    __table_args__ = (
        UniqueConstraint("customer_id", "tour_id", name="uq_customer_saved_tours"),
        Index("idx_customer_saved_tours_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE"), nullable=False
    )

    customer: Mapped[CustomerUser] = relationship(
        back_populates="saved_tours", lazy="raise"
    )
    tour: Mapped[Tour] = relationship(lazy="raise")


class CustomerWallet(TimestampMixin, Base):
    """Server-controlled wallet balance for a customer account."""

    __tablename__ = "customer_wallets"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    available_credit: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRR'"))

    customer: Mapped[CustomerUser] = relationship(back_populates="wallet", lazy="raise")


class AgencyProfile(TimestampMixin, Base):
    """Verified business identity and server-controlled purchasing credit."""

    __tablename__ = "agency_profiles"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_agency_profiles_status",
        ),
        CheckConstraint("credit_limit >= 0", name="chk_agency_profiles_credit_limit"),
        CheckConstraint("credit_used >= 0", name="chk_agency_profiles_credit_used"),
        CheckConstraint(
            "credit_reserved >= 0", name="chk_agency_profiles_credit_reserved"
        ),
        CheckConstraint(
            "credit_used + credit_reserved <= credit_limit",
            name="chk_agency_profiles_credit_balance",
        ),
        CheckConstraint(
            "national_id IS NOT NULL OR economic_code IS NOT NULL",
            name="chk_agency_profiles_business_identifier",
        ),
        Index("idx_agency_profiles_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    legal_name: Mapped[str] = mapped_column(String(180), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(64), nullable=False)
    national_id: Mapped[str | None] = mapped_column(String(32))
    economic_code: Mapped[str | None] = mapped_column(String(32))
    license_number: Mapped[str] = mapped_column(String(64), nullable=False)
    manager_name: Mapped[str] = mapped_column(String(120), nullable=False)
    manager_national_code: Mapped[str] = mapped_column(String(16), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    province: Mapped[str] = mapped_column(String(80), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'pending'"), nullable=False
    )
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    credit_used: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    credit_reserved: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), server_default=text("0"), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer: Mapped[CustomerUser] = relationship(
        back_populates="agency_profile", lazy="raise"
    )
    reviewed_by: Mapped[AdminUser | None] = relationship(lazy="raise")
    credit_events: Mapped[list[AgencyCreditEvent]] = relationship(
        back_populates="agency_profile",
        cascade="all, delete-orphan",
        lazy="raise",
    )

    @property
    def available_credit(self) -> Decimal:
        return max(
            Decimal(0), self.credit_limit - self.credit_used - self.credit_reserved
        )


class AgencyCreditEvent(Base):
    """Append-only audit record for every agency credit mutation."""

    __tablename__ = "agency_credit_events"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="chk_agency_credit_events_amount"),
        Index(
            "idx_agency_credit_events_agency_created", "agency_profile_id", "created_at"
        ),
        Index("idx_agency_credit_events_booking", "booking_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    agency_profile_id: Mapped[int] = mapped_column(
        ForeignKey("agency_profiles.id", ondelete="CASCADE"), nullable=False
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("booking_requests.id", ondelete="SET NULL")
    )
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    credit_limit_after: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    credit_used_after: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    credit_reserved_after: Mapped[Decimal] = mapped_column(
        Numeric(14, 0), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    agency_profile: Mapped[AgencyProfile] = relationship(
        back_populates="credit_events", lazy="raise"
    )


class WalletTopUp(TimestampMixin, Base):
    """A customer-initiated wallet recharge linked to one payment attempt."""

    __tablename__ = "wallet_topups"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_wallet_topups_amount"),
        CheckConstraint("currency = 'IRR'", name="chk_wallet_topups_currency"),
        CheckConstraint(
            "status IN ('pending', 'gateway_pending', 'paid', 'failed')",
            name="chk_wallet_topups_status",
        ),
        Index("idx_wallet_topups_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="RESTRICT"), nullable=False
    )
    payment_intent_id: Mapped[int] = mapped_column(
        ForeignKey("payment_intents.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
    )
    reference: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 0), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRR'"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(24), server_default=text("'pending'"), nullable=False
    )
    credited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CustomerPassenger(TimestampMixin, Base):
    """Reusable traveler identity that belongs to one customer only."""

    __tablename__ = "customer_passengers"
    __table_args__ = (
        CheckConstraint(
            "length(trim(full_name)) > 1", name="chk_customer_passengers_name"
        ),
        CheckConstraint(
            "gender IN ('male', 'female', 'unspecified')",
            name="chk_customer_passengers_gender",
        ),
        CheckConstraint(
            "age IS NULL OR (age >= 0 AND age <= 120)",
            name="chk_customer_passengers_age",
        ),
        CheckConstraint(
            "pet_weight_kg IS NULL OR (pet_weight_kg > 0 AND pet_weight_kg <= 100)",
            name="chk_customer_passengers_pet_weight",
        ),
        Index("idx_customer_passengers_customer_created", "customer_id", "created_at"),
        Index("idx_customer_passengers_customer_name", "customer_id", "full_name"),
        Index(
            "uq_customer_passengers_national_code",
            "customer_id",
            "national_code",
            unique=True,
            postgresql_where=text("national_code IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(60))
    last_name: Mapped[str | None] = mapped_column(String(60))
    father_name: Mapped[str | None] = mapped_column(String(60))
    first_name_en: Mapped[str | None] = mapped_column(String(60))
    last_name_en: Mapped[str | None] = mapped_column(String(60))
    national_code: Mapped[str | None] = mapped_column(String(16))
    passport_number: Mapped[str | None] = mapped_column(String(32))
    passport_expiry_date: Mapped[date | None] = mapped_column(Date)
    email: Mapped[str | None] = mapped_column(String(254))
    gender: Mapped[str] = mapped_column(
        String(16), server_default=text("'unspecified'"), nullable=False
    )
    age: Mapped[int | None] = mapped_column(SmallInteger)
    birth_date: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(32))
    has_pet: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    pet_name: Mapped[str | None] = mapped_column(String(80))
    pet_type: Mapped[str | None] = mapped_column(String(80))
    pet_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))

    customer: Mapped[CustomerUser] = relationship(
        back_populates="passengers", lazy="raise"
    )


class CustomerInsurance(TimestampMixin, Base):
    """Travel insurance policy registered for one authenticated customer."""

    __tablename__ = "customer_insurances"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'pending', 'expired', 'cancelled')",
            name="chk_customer_insurances_status",
        ),
        CheckConstraint(
            "coverage_amount IS NULL OR coverage_amount >= 0",
            name="chk_customer_insurances_coverage",
        ),
        CheckConstraint(
            "end_date >= start_date",
            name="chk_customer_insurances_dates",
        ),
        Index(
            "idx_customer_insurances_customer_dates",
            "customer_id",
            "end_date",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    policy_number: Mapped[str] = mapped_column(String(80), nullable=False)
    coverage_title: Mapped[str] = mapped_column(String(160), nullable=False)
    coverage_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'active'"), nullable=False
    )

    customer: Mapped[CustomerUser] = relationship(
        back_populates="insurances", lazy="raise"
    )


class CustomerSupportRequest(TimestampMixin, Base):
    """Account or guest support conversation with a controlled lifecycle."""

    __tablename__ = "customer_support_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'in_progress', 'closed')",
            name="chk_customer_support_request_status",
        ),
        CheckConstraint(
            "source IN ('account', 'chatbot')",
            name="chk_customer_support_request_source",
        ),
        CheckConstraint(
            "last_sender IN ('customer', 'bot', 'admin')",
            name="chk_customer_support_request_last_sender",
        ),
        Index(
            "idx_customer_support_requests_customer_created",
            "customer_id",
            "created_at",
        ),
        Index("idx_customer_support_requests_status_updated", "status", "updated_at"),
        Index(
            "uq_customer_support_requests_guest_token",
            "guest_token_hash",
            unique=True,
            postgresql_where=text("guest_token_hash IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE"), nullable=True
    )
    guest_token_hash: Mapped[str | None] = mapped_column(String(64))
    visitor_name: Mapped[str | None] = mapped_column(String(120))
    visitor_email: Mapped[str | None] = mapped_column(String(254))
    source: Mapped[str] = mapped_column(String(20), server_default=text("'account'"))
    subject: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default=text("'open'"))
    last_sender: Mapped[str] = mapped_column(
        String(20), server_default=text("'customer'")
    )

    customer: Mapped[CustomerUser | None] = relationship(
        back_populates="support_requests", lazy="raise"
    )
    messages: Mapped[list[SupportMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SupportMessage.id",
        lazy="raise",
    )


class SupportMessage(Base):
    """One immutable message in a support conversation."""

    __tablename__ = "support_messages"
    __table_args__ = (
        CheckConstraint(
            "sender_type IN ('customer', 'bot', 'admin')",
            name="chk_support_messages_sender_type",
        ),
        CheckConstraint(
            "char_length(body) BETWEEN 1 AND 4000",
            name="chk_support_messages_body_length",
        ),
        Index(
            "idx_support_messages_request_created",
            "support_request_id",
            "created_at",
            "id",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    support_request_id: Mapped[int] = mapped_column(
        ForeignKey("customer_support_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    conversation: Mapped[CustomerSupportRequest] = relationship(
        back_populates="messages", lazy="raise"
    )


class AvailabilityAlert(TimestampMixin, Base):
    """Customer request to be notified when a transport ticket becomes available."""

    __tablename__ = "availability_alerts"
    __table_args__ = (
        CheckConstraint(
            "service_type IN ('flight', 'train', 'bus')",
            name="chk_availability_alerts_service_type",
        ),
        UniqueConstraint(
            "customer_id",
            "service_type",
            "origin",
            "destination",
            "departure_date",
            name="uq_availability_alert_route",
        ),
        Index("idx_availability_alerts_active", "customer_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE")
    )
    service_type: Mapped[str] = mapped_column(String(16))
    origin: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str] = mapped_column(String(120))
    departure_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Destination(TimestampMixin, Base):
    """Editorial destination displayed by the website."""

    __tablename__ = "destinations"
    __table_args__ = (
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_destinations_publication_time",
        ),
        Index(
            "idx_destinations_published",
            text("published_at DESC"),
            postgresql_where=text("status = 'published'"),
        ),
        Index(
            "idx_destinations_featured",
            text("published_at DESC"),
            postgresql_where=text("status = 'published' AND is_featured = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    country: Mapped[str] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    internal_note: Mapped[str | None] = mapped_column(Text)
    attractions: Mapped[str | None] = mapped_column(Text)
    best_travel_time: Mapped[str | None] = mapped_column(String(160))
    travel_tips: Mapped[str | None] = mapped_column(Text)
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_installment_available: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    meta_title: Mapped[str | None] = mapped_column(String(70))
    meta_description: Mapped[str | None] = mapped_column(String(160))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    articles: Mapped[list[Article]] = relationship(
        back_populates="destination", lazy="raise"
    )
    faqs: Mapped[list[FAQ]] = relationship(back_populates="destination", lazy="raise")
    tours: Mapped[list[Tour]] = relationship(back_populates="destination", lazy="raise")
    hotels: Mapped[list[Hotel]] = relationship(
        back_populates="destination", lazy="raise"
    )
    gallery: Mapped[list[DestinationImage]] = relationship(
        back_populates="destination",
        cascade="all, delete-orphan",
        order_by="DestinationImage.display_order",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        """Expose ordered media IDs for API serialization."""
        return [item.image_id for item in self.gallery]


class DestinationImage(Base):
    """An ordered, bounded destination gallery image."""

    __tablename__ = "destination_images"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 5",
            name="chk_destination_images_display_order",
        ),
        UniqueConstraint(
            "destination_id", "image_id", name="uq_destination_images_image"
        ),
        UniqueConstraint(
            "destination_id", "display_order", name="uq_destination_images_order"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)

    destination: Mapped[Destination] = relationship(
        back_populates="gallery", lazy="raise"
    )


class Hotel(TimestampMixin, Base):
    """Editorial hotel offered for a destination."""

    __tablename__ = "hotels"
    __table_args__ = (
        CheckConstraint(
            "star_rating BETWEEN 1 AND 5",
            name="chk_hotels_star_rating",
        ),
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_hotels_publication_time",
        ),
        Index(
            "idx_hotels_destination_published",
            "destination_id",
            "star_rating",
            postgresql_where=text("status = 'published'"),
        ),
        Index(
            "idx_hotels_featured",
            text("published_at DESC"),
            postgresql_where=text("status = 'published' AND is_featured = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    hotel_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    avina_identification_code: Mapped[str | None] = mapped_column(
        String(160), unique=True
    )
    avina_profile: Mapped[dict | None] = mapped_column(JSON)
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    star_rating: Mapped[int] = mapped_column(SmallInteger)
    guest_rating: Mapped[str | None] = mapped_column(String(20))
    service_grade: Mapped[str | None] = mapped_column(String(40))
    service_type: Mapped[str | None] = mapped_column(String(40))
    service_category: Mapped[str | None] = mapped_column(String(40))
    default_room_type: Mapped[str | None] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    internal_note: Mapped[str | None] = mapped_column(Text)
    location_description: Mapped[str | None] = mapped_column(Text)
    rooms_description: Mapped[str | None] = mapped_column(Text)
    amenities_description: Mapped[str | None] = mapped_column(Text)
    dining_description: Mapped[str | None] = mapped_column(Text)
    booking_description: Mapped[str | None] = mapped_column(Text)
    pricing_description: Mapped[str | None] = mapped_column(Text)
    policies_description: Mapped[str | None] = mapped_column(Text)
    cancellation_policy: Mapped[str | None] = mapped_column(Text)
    base_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    child_with_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    child_without_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    infant_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRT'"))
    max_guests: Mapped[int | None] = mapped_column(SmallInteger)
    region: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(300))
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    image_alt_text: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    destination: Mapped[Destination] = relationship(
        back_populates="hotels", lazy="raise"
    )
    gallery: Mapped[list[HotelImage]] = relationship(
        back_populates="hotel",
        cascade="all, delete-orphan",
        order_by="HotelImage.display_order",
        lazy="raise",
    )
    room_types: Mapped[list[HotelRoom]] = relationship(
        back_populates="hotel",
        cascade="all, delete-orphan",
        order_by="HotelRoom.display_order",
        lazy="raise",
    )
    price_periods: Mapped[list[HotelPricePeriod]] = relationship(
        back_populates="hotel",
        cascade="all, delete-orphan",
        order_by="HotelPricePeriod.start_date",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        return [item.image_id for item in self.gallery]


class HotelRoom(Base):
    """One publicly priced room type belonging to a hotel."""

    __tablename__ = "hotel_rooms"
    __table_args__ = (
        CheckConstraint("price_amount >= 0", name="chk_hotel_rooms_price"),
        CheckConstraint("display_order >= 0", name="chk_hotel_rooms_display_order"),
        UniqueConstraint("hotel_id", "name", name="uq_hotel_rooms_name"),
        Index("idx_hotel_rooms_hotel_order", "hotel_id", "display_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    hotel_id: Mapped[int] = mapped_column(
        ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    price_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    hotel: Mapped[Hotel] = relationship(back_populates="room_types", lazy="raise")


class HotelPricePeriod(Base):
    """A seasonal hotel price range with optional passenger-specific prices."""

    __tablename__ = "hotel_price_periods"
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="chk_hotel_price_period_dates"),
        CheckConstraint("adult_price >= 0", name="chk_hotel_price_period_adult"),
        CheckConstraint(
            "child_with_bed_price IS NULL OR child_with_bed_price >= 0",
            name="chk_hotel_price_period_child_with_bed",
        ),
        CheckConstraint(
            "child_without_bed_price IS NULL OR child_without_bed_price >= 0",
            name="chk_hotel_price_period_child_without_bed",
        ),
        CheckConstraint(
            "infant_price IS NULL OR infant_price >= 0",
            name="chk_hotel_price_period_infant",
        ),
        UniqueConstraint(
            "hotel_id", "start_date", "end_date", name="uq_hotel_price_period_dates"
        ),
        Index("idx_hotel_price_period_lookup", "hotel_id", "start_date", "end_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    hotel_id: Mapped[int] = mapped_column(
        ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    adult_price: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    child_with_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_without_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    infant_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )

    hotel: Mapped[Hotel] = relationship(back_populates="price_periods", lazy="raise")


class HotelImage(Base):
    __tablename__ = "hotel_images"
    __table_args__ = (
        CheckConstraint("display_order BETWEEN 0 AND 5", name="chk_hotel_images_order"),
        UniqueConstraint("hotel_id", "image_id", name="uq_hotel_images_image"),
        UniqueConstraint("hotel_id", "display_order", name="uq_hotel_images_order"),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"))
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)
    hotel: Mapped[Hotel] = relationship(back_populates="gallery", lazy="raise")


class Article(TimestampMixin, Base):
    """Long-form editorial content."""

    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_articles_publication_time",
        ),
        Index(
            "idx_articles_published",
            text("published_at DESC"),
            postgresql_where=text("status = 'published'"),
        ),
        Index(
            "idx_articles_destination_published",
            "destination_id",
            text("published_at DESC"),
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    category: Mapped[str] = mapped_column(String(100))
    excerpt: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(120))
    internal_note: Mapped[str | None] = mapped_column(Text)
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    meta_title: Mapped[str | None] = mapped_column(String(70))
    meta_description: Mapped[str | None] = mapped_column(String(160))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    destination: Mapped[Destination | None] = relationship(
        back_populates="articles", lazy="raise"
    )
    gallery: Mapped[list[ArticleImage]] = relationship(
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="ArticleImage.display_order",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        return [item.image_id for item in self.gallery]


class ArticleImage(Base):
    __tablename__ = "article_images"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 5", name="chk_article_images_order"
        ),
        UniqueConstraint("article_id", "image_id", name="uq_article_images_image"),
        UniqueConstraint("article_id", "display_order", name="uq_article_images_order"),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE")
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)
    article: Mapped[Article] = relationship(back_populates="gallery", lazy="raise")


class FAQ(TimestampMixin, Base):
    """Frequently asked question, optionally scoped to a destination."""

    __tablename__ = "faqs"
    __table_args__ = (
        CheckConstraint("display_order >= 0", name="chk_faqs_display_order"),
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_faqs_publication_time",
        ),
        Index(
            "idx_faqs_published_order",
            "display_order",
            "id",
            postgresql_where=text("status = 'published'"),
        ),
        Index(
            "idx_faqs_destination_published",
            "destination_id",
            "display_order",
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    question: Mapped[str] = mapped_column(String(250))
    answer: Mapped[str] = mapped_column(Text)
    internal_note: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    destination: Mapped[Destination | None] = relationship(
        back_populates="faqs", lazy="raise"
    )


class Tour(Base):
    """CRM projection plus explicitly namespaced, locally managed tours."""

    __tablename__ = "crm_tour_cache"
    __table_args__ = (
        CheckConstraint(
            "duration_days IS NULL OR duration_days > 0",
            name="chk_crm_tour_cache_duration",
        ),
        CheckConstraint(
            "price_amount IS NULL OR price_amount >= 0",
            name="chk_crm_tour_cache_price",
        ),
        CheckConstraint(
            "currency IS NULL OR currency ~ '^[A-Z]{3}$'",
            name="chk_crm_tour_cache_currency",
        ),
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_crm_tour_cache_publication_time",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="chk_crm_tour_cache_display_order",
        ),
        CheckConstraint(
            "baggage_allowance_kg IS NULL OR baggage_allowance_kg >= 0",
            name="chk_tour_outbound_baggage",
        ),
        CheckConstraint(
            "return_baggage_allowance_kg IS NULL OR return_baggage_allowance_kg >= 0",
            name="chk_tour_return_baggage",
        ),
        Index(
            "idx_crm_tour_cache_listing",
            "departure_date",
            "id",
            postgresql_where=text("availability_status = 'available'"),
        ),
        Index(
            "idx_crm_tour_cache_destination",
            "destination_id",
            "departure_date",
            postgresql_where=text("availability_status = 'available'"),
        ),
        Index(
            "idx_crm_tour_cache_featured",
            "departure_date",
            postgresql_where=text(
                "availability_status = 'available' AND is_featured = true"
            ),
        ),
        Index(
            "idx_crm_tour_cache_filters",
            "tour_type",
            "origin",
            "price_amount",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    external_crm_id: Mapped[str] = mapped_column(String(128), unique=True)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    hotel_id: Mapped[int | None] = mapped_column(
        ForeignKey("hotels.id", ondelete="SET NULL")
    )
    hotel_name: Mapped[str | None] = mapped_column(String(180))
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'published'")
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    title: Mapped[str] = mapped_column(String(180))
    origin: Mapped[str | None] = mapped_column(String(100))
    tour_type: Mapped[str | None] = mapped_column(String(32))
    duration_days: Mapped[int | None] = mapped_column(SmallInteger)
    departure_date: Mapped[date | None] = mapped_column(Date)
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str | None] = mapped_column(String(3))
    transportation: Mapped[str | None] = mapped_column(String(120))
    origin_airport: Mapped[str | None] = mapped_column(String(160))
    origin_airport_code: Mapped[str | None] = mapped_column(String(3))
    destination_airport: Mapped[str | None] = mapped_column(String(160))
    destination_airport_code: Mapped[str | None] = mapped_column(String(3))
    airline_name: Mapped[str | None] = mapped_column(String(120))
    airline_logo_image_id: Mapped[int | None] = mapped_column(BigInteger)
    flight_number: Mapped[str | None] = mapped_column(String(32))
    departure_time: Mapped[time | None] = mapped_column(Time)
    arrival_time: Mapped[time | None] = mapped_column(Time)
    baggage_allowance_kg: Mapped[int | None] = mapped_column(SmallInteger)
    aircraft_name: Mapped[str | None] = mapped_column(String(120))
    travel_class: Mapped[str | None] = mapped_column(String(80))
    return_date: Mapped[date | None] = mapped_column(Date)
    return_origin_airport: Mapped[str | None] = mapped_column(String(160))
    return_origin_airport_code: Mapped[str | None] = mapped_column(String(3))
    return_destination_airport: Mapped[str | None] = mapped_column(String(160))
    return_destination_airport_code: Mapped[str | None] = mapped_column(String(3))
    return_airline_name: Mapped[str | None] = mapped_column(String(120))
    return_airline_logo_image_id: Mapped[int | None] = mapped_column(BigInteger)
    return_flight_number: Mapped[str | None] = mapped_column(String(32))
    return_departure_time: Mapped[time | None] = mapped_column(Time)
    return_arrival_time: Mapped[time | None] = mapped_column(Time)
    return_baggage_allowance_kg: Mapped[int | None] = mapped_column(SmallInteger)
    return_aircraft_name: Mapped[str | None] = mapped_column(String(120))
    return_travel_class: Mapped[str | None] = mapped_column(String(80))
    destination_language: Mapped[str | None] = mapped_column(String(80))
    destination_currency: Mapped[str | None] = mapped_column(String(80))
    best_travel_time: Mapped[str | None] = mapped_column(String(300))
    rating_score: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))
    rating_count: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    summary: Mapped[str | None] = mapped_column(String(300))
    meta_title: Mapped[str | None] = mapped_column(String(70))
    meta_description: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    itinerary: Mapped[str | None] = mapped_column(Text)
    included_services: Mapped[str | None] = mapped_column(Text)
    excluded_services: Mapped[str | None] = mapped_column(Text)
    required_documents: Mapped[str | None] = mapped_column(Text)
    tour_notes: Mapped[str | None] = mapped_column(Text)
    refund_policy: Mapped[str | None] = mapped_column(Text)
    installment_terms: Mapped[str | None] = mapped_column(Text)
    image_alt_text: Mapped[str | None] = mapped_column(String(255))
    flight_included: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    airport_transfer_included: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    flight_price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    flight_price_currency: Mapped[str | None] = mapped_column(String(3))
    is_combined_stay: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    internal_note: Mapped[str | None] = mapped_column(Text)
    stay_nights: Mapped[int | None] = mapped_column(SmallInteger)
    max_passengers: Mapped[int | None] = mapped_column(SmallInteger)
    availability_status: Mapped[str] = mapped_column(
        String(32), server_default=text("'unknown'")
    )
    is_home_recommended: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false")
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_installment_available: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_direct_flight: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_last_minute: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    badge_label: Mapped[str | None] = mapped_column(String(40))
    display_order: Mapped[int] = mapped_column(
        SmallInteger, server_default=text("0"), nullable=False
    )
    crm_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    raw_version: Mapped[str | None] = mapped_column(String(128))

    destination: Mapped[Destination | None] = relationship(
        back_populates="tours", lazy="raise"
    )
    hotel: Mapped[Hotel | None] = relationship(lazy="raise")
    gallery: Mapped[list[TourImage]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourImage.display_order",
        lazy="raise",
    )
    itinerary_days: Mapped[list[TourItineraryDay]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourItineraryDay.day_number",
        lazy="raise",
    )
    departures: Mapped[list[TourDeparture]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourDeparture.display_order",
        lazy="raise",
    )
    travel_legs: Mapped[list[TourTravelLeg]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourTravelLeg.display_order",
        lazy="raise",
    )
    hotel_packages: Mapped[list[TourHotelPackage]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourHotelPackage.display_order",
        lazy="raise",
    )
    combined_packages: Mapped[list[TourCombinedPackage]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourCombinedPackage.display_order",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        """Expose ordered media IDs without leaking association rows."""
        return [item.image_id for item in self.gallery]


class TourImage(Base):
    """An ordered, foreign-keyed tour gallery item."""

    __tablename__ = "tour_images"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 5",
            name="chk_tour_images_display_order",
        ),
        UniqueConstraint(
            "tour_id",
            "image_id",
            name="uq_tour_images_image",
        ),
        UniqueConstraint(
            "tour_id",
            "display_order",
            name="uq_tour_images_order",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)

    tour: Mapped[Tour] = relationship(back_populates="gallery", lazy="raise")


class TourItineraryDay(Base):
    """One ordered day in a tour itinerary."""

    __tablename__ = "tour_itinerary_days"
    __table_args__ = (
        CheckConstraint("day_number BETWEEN 1 AND 365", name="chk_itinerary_day"),
        UniqueConstraint("tour_id", "day_number", name="uq_tour_itinerary_day"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    day_number: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    tour: Mapped[Tour] = relationship(back_populates="itinerary_days", lazy="raise")


class TourTravelLeg(Base):
    """One ordered movement within a multi-leg tour route."""

    __tablename__ = "tour_travel_legs"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 49",
            name="chk_tour_travel_legs_order",
        ),
        UniqueConstraint(
            "tour_id",
            "display_order",
            name="uq_tour_travel_legs_order",
        ),
        Index("idx_tour_travel_legs_tour_order", "tour_id", "display_order"),
        Index("idx_tour_travel_legs_destination", "destination_id"),
        Index("idx_tour_travel_legs_hotel", "hotel_id"),
        CheckConstraint(
            "stay_nights IS NULL OR stay_nights > 0",
            name="chk_tour_leg_stay_nights",
        ),
        CheckConstraint(
            "arrival_date IS NULL OR arrival_date >= departure_date",
            name="chk_tour_leg_arrival_date",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    destination_id: Mapped[int | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    hotel_id: Mapped[int | None] = mapped_column(
        ForeignKey("hotels.id", ondelete="SET NULL")
    )
    title: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    stage_type: Mapped[str | None] = mapped_column(String(80))
    duration_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    travel_class: Mapped[str | None] = mapped_column(String(80))
    baggage_allowance_kg: Mapped[int | None] = mapped_column(SmallInteger)
    transportation: Mapped[str | None] = mapped_column(String(50))
    departure_date: Mapped[date | None] = mapped_column(Date)
    arrival_date: Mapped[date | None] = mapped_column(Date)
    departure_time: Mapped[time | None] = mapped_column(Time)
    arrival_time: Mapped[time | None] = mapped_column(Time)
    airline_name: Mapped[str | None] = mapped_column(String(120))
    flight_number: Mapped[str | None] = mapped_column(String(32))
    stay_nights: Mapped[int | None] = mapped_column(SmallInteger)
    origin: Mapped[str | None] = mapped_column(String(120))
    origin_terminal: Mapped[str | None] = mapped_column(String(160))
    destination: Mapped[str | None] = mapped_column(String(120))
    destination_terminal: Mapped[str | None] = mapped_column(String(160))
    tour: Mapped[Tour] = relationship(back_populates="travel_legs", lazy="raise")


class TourDeparture(Base):
    """One selectable departure date or recurring departure label."""

    __tablename__ = "tour_departures"
    __table_args__ = (
        CheckConstraint(
            "price_amount IS NULL OR price_amount >= 0",
            name="chk_departure_price",
        ),
        CheckConstraint(
            "nights IS NULL OR nights > 0",
            name="chk_departure_nights",
        ),
        UniqueConstraint("tour_id", "display_order", name="uq_tour_departure_order"),
        CheckConstraint(
            (
                "outbound_baggage_allowance_kg IS NULL OR "
                "outbound_baggage_allowance_kg >= 0"
            ),
            name="chk_tour_departure_outbound_baggage",
        ),
        CheckConstraint(
            "return_baggage_allowance_kg IS NULL OR return_baggage_allowance_kg >= 0",
            name="chk_tour_departure_return_baggage",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    label: Mapped[str] = mapped_column(String(160))
    external_code: Mapped[str | None] = mapped_column(String(64))
    price_set_code: Mapped[str | None] = mapped_column(String(64))
    departure_date: Mapped[date | None] = mapped_column(Date)
    return_date: Mapped[date | None] = mapped_column(Date)
    capacity_total: Mapped[int | None] = mapped_column(SmallInteger)
    capacity_remaining: Mapped[int | None] = mapped_column(SmallInteger)
    booking_status: Mapped[str] = mapped_column(
        String(24), server_default=text("'open'")
    )
    outbound_flight_number: Mapped[str | None] = mapped_column(String(32))
    outbound_airline_name: Mapped[str | None] = mapped_column(String(120))
    outbound_airline_logo_image_id: Mapped[int | None] = mapped_column(BigInteger)
    outbound_origin_airport: Mapped[str | None] = mapped_column(String(160))
    outbound_origin_airport_code: Mapped[str | None] = mapped_column(String(3))
    outbound_destination_airport: Mapped[str | None] = mapped_column(String(160))
    outbound_destination_airport_code: Mapped[str | None] = mapped_column(String(3))
    outbound_departure_time: Mapped[time | None] = mapped_column(Time)
    outbound_arrival_time: Mapped[time | None] = mapped_column(Time)
    outbound_baggage_allowance_kg: Mapped[int | None] = mapped_column(SmallInteger)
    outbound_aircraft_name: Mapped[str | None] = mapped_column(String(120))
    outbound_travel_class: Mapped[str | None] = mapped_column(String(80))
    return_flight_number: Mapped[str | None] = mapped_column(String(32))
    return_airline_name: Mapped[str | None] = mapped_column(String(120))
    return_airline_logo_image_id: Mapped[int | None] = mapped_column(BigInteger)
    return_origin_airport: Mapped[str | None] = mapped_column(String(160))
    return_origin_airport_code: Mapped[str | None] = mapped_column(String(3))
    return_destination_airport: Mapped[str | None] = mapped_column(String(160))
    return_destination_airport_code: Mapped[str | None] = mapped_column(String(3))
    return_departure_time: Mapped[time | None] = mapped_column(Time)
    return_arrival_time: Mapped[time | None] = mapped_column(Time)
    return_baggage_allowance_kg: Mapped[int | None] = mapped_column(SmallInteger)
    return_aircraft_name: Mapped[str | None] = mapped_column(String(120))
    return_travel_class: Mapped[str | None] = mapped_column(String(80))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    nights: Mapped[int | None] = mapped_column(SmallInteger)
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRR'"))
    display_order: Mapped[int] = mapped_column(SmallInteger)
    tour: Mapped[Tour] = relationship(back_populates="departures", lazy="raise")
    hotel_prices: Mapped[list[TourDepartureHotelPrice]] = relationship(
        back_populates="departure",
        cascade="all, delete-orphan",
        order_by="TourDepartureHotelPrice.display_order",
        lazy="raise",
    )


class TourDepartureHotelPrice(Base):
    """Hotel and passenger pricing for one exact tour departure."""

    __tablename__ = "tour_departure_hotel_prices"
    __table_args__ = (
        CheckConstraint("double_price >= 0", name="chk_tdhp_double_price"),
        CheckConstraint("single_price >= 0", name="chk_tdhp_single_price"),
        CheckConstraint(
            "child_with_bed_price >= 0", name="chk_tdhp_child_with_bed_price"
        ),
        CheckConstraint(
            "child_without_bed_price >= 0", name="chk_tdhp_child_without_bed_price"
        ),
        CheckConstraint("infant_price >= 0", name="chk_tdhp_infant_price"),
        CheckConstraint("flight_price_per_person >= 0", name="chk_tdhp_flight_price"),
        CheckConstraint(
            "capacity_total IS NULL OR capacity_total >= 0",
            name="chk_tdhp_capacity_total",
        ),
        CheckConstraint(
            "capacity_remaining IS NULL OR capacity_remaining >= 0",
            name="chk_tdhp_capacity_remaining",
        ),
        UniqueConstraint(
            "departure_id",
            "hotel_id",
            "room_type",
            "service_type",
            name="uq_tdhp_departure_hotel_offer",
        ),
        Index("idx_tdhp_departure_order", "departure_id", "display_order"),
        Index("idx_tdhp_hotel", "hotel_id"),
        Index("idx_tdhp_external_price_code", "external_price_code"),
        Index("idx_tdhp_price_set_code", "price_set_code"),
        Index(
            "uq_tdhp_departure_base_package",
            "departure_id",
            unique=True,
            postgresql_where=text("is_base_package"),
            sqlite_where=text("is_base_package"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    departure_id: Mapped[int] = mapped_column(
        ForeignKey("tour_departures.id", ondelete="CASCADE")
    )
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"))
    room_type: Mapped[str] = mapped_column(
        String(80), server_default=text("'Standard'")
    )
    service_type: Mapped[str] = mapped_column(String(40))
    external_price_code: Mapped[str | None] = mapped_column(String(64))
    price_set_code: Mapped[str | None] = mapped_column(String(64))
    double_price: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    single_price: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    child_with_bed_price: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    extra_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "extra_price IS NULL OR extra_price >= 0", name="chk_tdhp_extra_price"
        ),
    )
    extra_currency: Mapped[str | None] = mapped_column(String(3))
    package_currency: Mapped[str] = mapped_column(String(3))
    double_currency: Mapped[str | None] = mapped_column(String(3))
    single_currency: Mapped[str | None] = mapped_column(String(3))
    child_with_bed_currency: Mapped[str | None] = mapped_column(String(3))
    child_without_bed_price: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    child_without_bed_currency: Mapped[str] = mapped_column(String(3))
    infant_price: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    infant_currency: Mapped[str] = mapped_column(String(3))
    double_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "double_flight_price IS NULL OR double_flight_price >= 0",
            name="chk_tour_departure_hotel_prices_double_flight_price",
        ),
    )
    single_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "single_flight_price IS NULL OR single_flight_price >= 0",
            name="chk_tour_departure_hotel_prices_single_flight_price",
        ),
    )
    flight_price_per_person: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    flight_currency: Mapped[str] = mapped_column(String(3))
    child_with_bed_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "child_with_bed_flight_price IS NULL OR child_with_bed_flight_price >= 0",
            name="chk_tdhp_child_flight_price",
        ),
    )
    child_with_bed_flight_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'")
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    is_base_package: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    capacity_total: Mapped[int | None] = mapped_column(SmallInteger)
    capacity_remaining: Mapped[int | None] = mapped_column(SmallInteger)
    display_order: Mapped[int] = mapped_column(SmallInteger)

    departure: Mapped[TourDeparture] = relationship(
        back_populates="hotel_prices", lazy="raise"
    )
    hotel: Mapped[Hotel] = relationship(lazy="raise")


class TourHotelPackage(Base):
    """Hotel pricing and stay details that apply to one tour."""

    __tablename__ = "tour_hotel_packages"
    __table_args__ = (
        CheckConstraint("nights > 0", name="chk_tour_hotel_package_nights"),
        CheckConstraint(
            "double_price IS NULL OR double_price >= 0",
            name="chk_tour_hotel_double_price",
        ),
        UniqueConstraint(
            "tour_id", "display_order", name="uq_tour_hotel_package_order"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"))
    city: Mapped[str | None] = mapped_column(String(100))
    nights: Mapped[int] = mapped_column(SmallInteger)
    board_type: Mapped[str | None] = mapped_column(String(40))
    double_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    single_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    child_with_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    child_without_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    max_adults: Mapped[int | None] = mapped_column(SmallInteger)
    max_children: Mapped[int | None] = mapped_column(SmallInteger)
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRR'"))
    display_order: Mapped[int] = mapped_column(SmallInteger)
    tour: Mapped[Tour] = relationship(back_populates="hotel_packages", lazy="raise")
    hotel: Mapped[Hotel] = relationship(lazy="raise")


class TourCombinedPackage(Base):
    """One named multi-hotel stay with independent passenger pricing."""

    __tablename__ = "tour_combined_packages"
    __table_args__ = (
        CheckConstraint(
            "double_price IS NULL OR double_price >= 0",
            name="chk_tour_combined_double_price",
        ),
        CheckConstraint(
            "single_price IS NULL OR single_price >= 0",
            name="chk_tour_combined_single_price",
        ),
        CheckConstraint(
            "child_with_bed_price IS NULL OR child_with_bed_price >= 0",
            name="chk_tour_combined_child_with_bed_price",
        ),
        CheckConstraint(
            "child_without_bed_price IS NULL OR child_without_bed_price >= 0",
            name="chk_tour_combined_child_without_bed_price",
        ),
        CheckConstraint(
            "infant_price IS NULL OR infant_price >= 0",
            name="chk_tour_combined_infant_price",
        ),
        CheckConstraint(
            "regular_flight_price IS NULL OR regular_flight_price >= 0",
            name="chk_tour_combined_regular_flight_price",
        ),
        CheckConstraint(
            "child_without_bed_flight_price IS NULL "
            "OR child_without_bed_flight_price >= 0",
            name="chk_tour_combined_child_flight_price",
        ),
        CheckConstraint(
            "extra_price IS NULL OR extra_price >= 0",
            name="chk_tour_combined_extra_price",
        ),
        UniqueConstraint(
            "tour_id", "display_order", name="uq_tour_combined_package_order"
        ),
        Index("idx_tour_combined_package_tour", "tour_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    tour_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tour_cache.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(160))
    double_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    double_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    single_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    single_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    child_with_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_with_bed_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    child_without_bed_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    child_without_bed_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    infant_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    infant_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    double_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "double_flight_price IS NULL OR double_flight_price >= 0",
            name="chk_tour_combined_packages_double_flight_price",
        ),
    )
    single_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2),
        CheckConstraint(
            "single_flight_price IS NULL OR single_flight_price >= 0",
            name="chk_tour_combined_packages_single_flight_price",
        ),
    )
    regular_flight_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    regular_flight_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    child_without_bed_flight_price: Mapped[Decimal | None] = mapped_column(
        Numeric(16, 2)
    )
    child_without_bed_flight_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    extra_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    extra_currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'IRT'"), nullable=False
    )
    add_flight_to_double: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    add_flight_to_single: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    add_flight_to_child_with_bed: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    add_flight_to_child_without_bed: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    add_flight_to_infant: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)

    tour: Mapped[Tour] = relationship(back_populates="combined_packages", lazy="raise")
    departure_prices: Mapped[list[TourCombinedDeparturePrice]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TourCombinedDeparturePrice.departure_id",
        lazy="raise",
    )
    hotels: Mapped[list[TourCombinedPackageHotel]] = relationship(
        back_populates="combined_package",
        cascade="all, delete-orphan",
        order_by="TourCombinedPackageHotel.display_order",
        lazy="raise",
    )


class TourCombinedPackageHotel(Base):
    """A hotel and stay duration assigned to a combined tour package."""

    __tablename__ = "tour_combined_package_hotels"
    __table_args__ = (
        CheckConstraint("nights > 0", name="chk_tour_combined_hotel_nights"),
        UniqueConstraint(
            "combined_package_id",
            "hotel_id",
            name="uq_tour_combined_package_hotel",
        ),
        Index("idx_tour_combined_package_hotel_package", "combined_package_id"),
        Index("idx_tour_combined_package_hotel_hotel", "hotel_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    combined_package_id: Mapped[int] = mapped_column(
        ForeignKey("tour_combined_packages.id", ondelete="CASCADE")
    )
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"))
    nights: Mapped[int] = mapped_column(SmallInteger)
    board_type: Mapped[str | None] = mapped_column(String(40))
    display_order: Mapped[int] = mapped_column(SmallInteger)

    combined_package: Mapped[TourCombinedPackage] = relationship(
        back_populates="hotels", lazy="raise"
    )
    hotel: Mapped[Hotel] = relationship(lazy="raise")


class TravelService(TimestampMixin, Base):
    """Editable travel service displayed on the public services pages."""

    __tablename__ = "travel_services"
    __table_args__ = (
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="chk_travel_services_publication_time",
        ),
        Index(
            "idx_travel_services_published",
            "display_order",
            "id",
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    service_type: Mapped[str] = mapped_column(String(40))
    service_category: Mapped[str | None] = mapped_column(String(40))
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    internal_note: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(100))
    origin: Mapped[str | None] = mapped_column(String(120))
    destination_name: Mapped[str | None] = mapped_column(String(120))
    origin_airport: Mapped[str | None] = mapped_column(String(160))
    origin_airport_code: Mapped[str | None] = mapped_column(String(3))
    destination_airport: Mapped[str | None] = mapped_column(String(160))
    destination_airport_code: Mapped[str | None] = mapped_column(String(3))
    departure_date: Mapped[date | None] = mapped_column(Date)
    return_date: Mapped[date | None] = mapped_column(Date)
    departure_time: Mapped[time | None] = mapped_column(Time)
    arrival_time: Mapped[time | None] = mapped_column(Time)
    return_time: Mapped[time | None] = mapped_column(Time)
    return_arrival_time: Mapped[time | None] = mapped_column(Time)
    baggage_allowance: Mapped[str | None] = mapped_column(String(120))
    provider_company: Mapped[str | None] = mapped_column(String(160))
    provider_icon_image_id: Mapped[int | None] = mapped_column(BigInteger)
    origin_terminal: Mapped[str | None] = mapped_column(String(120))
    destination_terminal: Mapped[str | None] = mapped_column(String(120))
    transport_class: Mapped[str | None] = mapped_column(String(120))
    refund_policy: Mapped[str | None] = mapped_column(Text)
    flight_class: Mapped[str | None] = mapped_column(String(32))
    flight_number: Mapped[str | None] = mapped_column(String(32))
    return_flight_number: Mapped[str | None] = mapped_column(String(32))
    stops_count: Mapped[int | None] = mapped_column(SmallInteger)
    available_seats: Mapped[int | None] = mapped_column(SmallInteger)
    trip_type: Mapped[str | None] = mapped_column(String(16))
    compartment_type: Mapped[str | None] = mapped_column(String(16))
    passenger_category: Mapped[str | None] = mapped_column(String(16))
    car_transport: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    flight_scope: Mapped[str | None] = mapped_column(String(16))
    aircraft_model: Mapped[str | None] = mapped_column(String(120))
    base_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'IRR'"))
    visa_requirements: Mapped[str | None] = mapped_column(Text)
    visa_document_requirements: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    visa_type: Mapped[str | None] = mapped_column(String(24))
    visa_processing_time: Mapped[str | None] = mapped_column(String(120))
    visa_form_url: Mapped[str | None] = mapped_column(String(500))
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    display_order: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    status: Mapped[PublicationStatus] = mapped_column(
        publication_status_enum, server_default=text("'draft'")
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    meta_title: Mapped[str | None] = mapped_column(String(70))
    meta_description: Mapped[str | None] = mapped_column(String(160))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gallery: Mapped[list[TravelServiceImage]] = relationship(
        back_populates="service",
        cascade="all, delete-orphan",
        order_by="TravelServiceImage.display_order",
        lazy="raise",
    )

    @property
    def gallery_image_ids(self) -> list[int]:
        return [item.image_id for item in self.gallery]


class TravelServiceImage(Base):
    __tablename__ = "travel_service_images"
    __table_args__ = (
        CheckConstraint(
            "display_order BETWEEN 0 AND 5", name="chk_service_images_order"
        ),
        UniqueConstraint("service_id", "image_id", name="uq_service_images_image"),
        UniqueConstraint("service_id", "display_order", name="uq_service_images_order"),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("travel_services.id", ondelete="CASCADE")
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    display_order: Mapped[int] = mapped_column(SmallInteger)
    service: Mapped[TravelService] = relationship(
        back_populates="gallery", lazy="raise"
    )


class VisaApplication(TimestampMixin, Base):
    """A private visa review request submitted by a customer."""

    __tablename__ = "visa_applications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'pending_review', 'needs_documents', "
            "'approved', 'rejected')",
            name="chk_visa_applications_status",
        ),
        Index(
            "idx_visa_applications_customer_created", "customer_user_id", "created_at"
        ),
        Index("idx_visa_applications_status_created", "status", "created_at"),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(
        ForeignKey("customer_users.id", ondelete="CASCADE")
    )
    travel_service_id: Mapped[int] = mapped_column(
        ForeignKey("travel_services.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(24), server_default=text("'draft'"))
    customer_message: Mapped[str | None] = mapped_column(Text)
    internal_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL")
    )
    customer: Mapped[CustomerUser] = relationship(lazy="raise")
    travel_service: Mapped[TravelService] = relationship(lazy="raise")
    documents: Mapped[list[VisaApplicationDocument]] = relationship(
        back_populates="visa_application",
        cascade="all, delete-orphan",
        order_by="VisaApplicationDocument.id",
        lazy="raise",
    )


class VisaApplicationDocument(Base):
    """Private evidence file; never served through public media."""

    __tablename__ = "visa_application_documents"
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    visa_application_id: Mapped[int] = mapped_column(
        ForeignKey("visa_applications.id", ondelete="CASCADE")
    )
    original_name: Mapped[str] = mapped_column(String(255))
    document_type: Mapped[str] = mapped_column(
        String(120), server_default=text("'مدرک تکمیلی'")
    )
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    mime_type: Mapped[str] = mapped_column(String(120))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    visa_application: Mapped[VisaApplication] = relationship(
        back_populates="documents", lazy="raise"
    )
