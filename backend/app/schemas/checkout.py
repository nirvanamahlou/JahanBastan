"""Checkout, installment, document, and administration contracts."""

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class CheckoutSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class InstallmentQuoteRequest(CheckoutSchema):
    total_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=0)
    down_payment: Decimal = Field(ge=0, max_digits=14, decimal_places=0)
    months: Literal[3, 6, 9, 12]
    monthly_fee_rate: Decimal = Field(ge=0, le=100, max_digits=6, decimal_places=2)
    first_due_date: date

    @model_validator(mode="after")
    def validate_down_payment(self) -> "InstallmentQuoteRequest":
        if self.down_payment >= self.total_amount:
            raise ValueError("پیش‌پرداخت باید کمتر از مبلغ کل باشد")
        return self


class InstallmentLine(CheckoutSchema):
    sequence: int
    due_date: date
    amount: Decimal
    paid_amount: Decimal = Decimal(0)
    status: str = "upcoming"


class InstallmentQuote(CheckoutSchema):
    total_amount: Decimal
    down_payment: Decimal
    financed_amount: Decimal
    fee_amount: Decimal
    installment_total: Decimal
    monthly_amount: Decimal
    months: int
    first_due_date: date
    schedule: list[InstallmentLine]


class DocumentRequirementWrite(CheckoutSchema):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    category: Literal["identity", "travel", "visa", "installment", "payment", "other"]
    applies_to: Literal["all", "tour", "flight", "train", "bus", "installment"]
    is_required: bool = True
    is_active: bool = True
    allowed_extensions: list[Literal["pdf", "jpg", "jpeg", "png"]] = Field(
        default_factory=lambda: ["pdf", "jpg", "jpeg", "png"], min_length=1
    )
    max_bytes: int = Field(default=8 * 1024 * 1024, ge=100_000, le=20 * 1024 * 1024)
    display_order: int = Field(default=0, ge=0, le=1000)


class DocumentRequirementRead(DocumentRequirementWrite):
    id: int
    created_at: datetime
    updated_at: datetime


class BookingDocumentRead(CheckoutSchema):
    id: int
    booking_id: int
    customer_id: int
    requirement_id: int | None
    passenger_index: int | None
    passenger_name: str | None = None
    customer_name: str | None = None
    booking_number: str | None = None
    original_name: str
    mime_type: str
    byte_size: int
    status: str
    review_note: str | None
    created_at: datetime
    updated_at: datetime


class DocumentReview(CheckoutSchema):
    status: Literal["approved", "rejected"]
    review_note: str | None = Field(default=None, max_length=500)


class InstallmentPaymentReview(CheckoutSchema):
    status: Literal["paid", "partial", "waived", "rescheduled"]
    paid_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=0)
    payment_reference: str | None = Field(default=None, max_length=160)
    admin_note: str | None = Field(default=None, max_length=500)
    due_date: date | None = None


class CheckoutConfiguration(CheckoutSchema):
    cash_enabled: bool = True
    installment_enabled: bool = True
    min_down_payment_percent: Decimal = Decimal(50)
    default_down_payment_percent: Decimal = Decimal(50)
    allowed_months: list[int] = Field(default_factory=lambda: [3, 6, 9, 12])
    monthly_fee_rate: Decimal = Decimal(5)
    max_credit_amount: Decimal = Decimal(250_000_000)
    usd_to_irt: Decimal = Decimal(0)
    eur_to_irt: Decimal = Decimal(0)
    terms_version: str = "checkout-1405-01"
    document_requirements: list[DocumentRequirementRead]


def rounded_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
