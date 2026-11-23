"""Validation contracts for provider-independent commercial operations."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from pydantic.alias_generators import to_camel


class OperationsSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class LeadActivityRead(OperationsSchema):
    id: int
    activity_type: str
    body: str
    created_at: datetime


class LeadCreate(OperationsSchema):
    subject: str = Field(min_length=3, max_length=180)
    details: str | None = Field(default=None, max_length=4_000)
    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str | None = Field(default=None, max_length=32)
    contact_email: EmailStr | None = None
    expected_amount: Decimal | None = Field(default=None, gt=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")


class LeadRead(OperationsSchema):
    id: int
    customer_id: int | None
    booking_id: int | None
    assigned_admin_id: int | None
    source: str
    subject: str
    details: str | None
    contact_name: str
    contact_phone: str | None
    contact_email: str | None
    status: str
    priority: str
    expected_amount: Decimal | None
    currency: str
    next_follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime
    activities: list[LeadActivityRead] = Field(default_factory=list)


class LeadUpdate(OperationsSchema):
    status: (
        Literal["new", "contacted", "qualified", "proposal_sent", "won", "lost"] | None
    ) = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    assigned_admin_id: int | None = Field(default=None, gt=0)
    next_follow_up_at: datetime | None = None
    activity_note: str | None = Field(default=None, min_length=2, max_length=4_000)


class CancellationCreate(OperationsSchema):
    reason: str = Field(min_length=10, max_length=4_000)


class CancellationRead(OperationsSchema):
    id: int
    booking_id: int
    customer_id: int
    reviewed_by_admin_id: int | None
    reason: str
    status: str
    resolution_note: str | None
    refund_amount: Decimal | None
    refund_status: str
    refund_reference: str | None
    refunded_at: datetime | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CancellationUpdate(OperationsSchema):
    status: Literal["in_review", "approved", "rejected", "completed"]
    resolution_note: str | None = Field(default=None, max_length=4_000)
    refund_amount: Decimal | None = Field(default=None, ge=0)


class NewsletterSubscribe(OperationsSchema):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)


class NewsletterSubscriberRead(OperationsSchema):
    id: int
    email: str
    full_name: str | None
    phone: str | None
    is_active: bool
    consent_at: datetime
    created_at: datetime


class DiscountCodeCreate(OperationsSchema):
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    title: str = Field(min_length=3, max_length=160)
    discount_type: Literal["fixed", "percentage"]
    amount: Decimal = Field(gt=0)
    percentage_limit: int | None = Field(default=None, ge=1, le=100)
    max_uses: int | None = Field(default=None, gt=0)
    minimum_order_amount: Decimal | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    applies_to: dict[str, str] = Field(default_factory=dict)


class DiscountCodeRead(DiscountCodeCreate):
    id: int
    used_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DiscountCodeUpdate(OperationsSchema):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    is_active: bool | None = None
    max_uses: int | None = Field(default=None, gt=0)
    ends_at: datetime | None = None


class ProductReviewCreate(OperationsSchema):
    target_type: Literal["tour", "hotel", "page"]
    target_id: int | None = Field(default=None, gt=0)
    page_path: str | None = Field(default=None, min_length=1, max_length=300)
    page_title: str | None = Field(default=None, max_length=180)
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=160)
    body: str = Field(min_length=10, max_length=4_000)

    @model_validator(mode="after")
    def validate_target(self) -> "ProductReviewCreate":
        if self.target_type == "page":
            if self.target_id is not None or not self.page_path:
                raise ValueError("page reviews require page_path and no target_id")
            if not self.page_path.startswith("/") or self.page_path.startswith("//"):
                raise ValueError("page_path must be a local absolute path")
        elif self.target_id is None or self.page_path is not None:
            raise ValueError("tour and hotel reviews require target_id")
        return self


class ProductReviewRead(OperationsSchema):
    id: int
    customer_id: int
    target_type: str
    target_id: int | None
    page_path: str | None
    page_title: str | None
    author_name_snapshot: str
    rating: int
    title: str | None
    body: str
    status: str
    moderation_note: str | None
    created_at: datetime
    updated_at: datetime


class PublicProductReviewRead(OperationsSchema):
    id: int
    rating: int
    title: str | None
    body: str
    author_name_snapshot: str
    created_at: datetime


class ProductReviewUpdate(OperationsSchema):
    status: Literal["approved", "rejected"]
    moderation_note: str | None = Field(default=None, max_length=2_000)


class CustomerNotificationRead(OperationsSchema):
    id: int
    notification_type: str
    title: str
    body: str
    link: str | None
    is_read: bool
    created_at: datetime


class PopularTourRead(OperationsSchema):
    title: str
    bookings: int


class OperationsDashboardRead(OperationsSchema):
    bookings_total: int
    bookings_pending: int
    bookings_paid: int
    confirmed_revenue: Decimal
    customers_total: int
    leads_open: int
    cancellation_open: int
    support_open: int
    reviews_pending: int
    newsletter_active: int
    bookings_cancelled: int
    payments_pending: int
    refund_total: Decimal
    customers_active_30_days: int
    popular_tours: list[PopularTourRead] = Field(default_factory=list)
