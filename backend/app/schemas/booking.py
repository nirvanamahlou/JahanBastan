"""Customer booking request and administration contracts."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.schemas.account import CartItemCreate, CustomerPassengerWrite


class BookingSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class BookingPassengerSnapshot(CustomerPassengerWrite):
    """Passenger data copied onto the booking for fulfilment and audit."""

    id: int | None = Field(default=None, gt=0)
    passenger_type: Literal["adult", "child", "infant"] = "adult"


class BookingPassengerRead(BookingSchema):
    first_name: str
    last_name: str
    father_name: str | None = None
    first_name_en: str | None = None
    last_name_en: str | None = None
    full_name: str
    passenger_type: str = "adult"
    national_code: str | None = None
    passport_number: str | None = None
    passport_expiry_date: date | None = None
    email: str | None = None
    gender: str = "unspecified"
    age: int | None = None
    birth_date: date | None = None
    phone: str | None = None
    has_pet: bool = False
    pet_name: str | None = None
    pet_type: str | None = None
    pet_weight_kg: Decimal | None = None


class BookingCreate(BookingSchema):
    customer_note: str | None = Field(default=None, max_length=1000)
    passengers: list[BookingPassengerSnapshot] = Field(
        default_factory=list, max_length=20
    )

    payment_method: Literal["cash", "installment", "agency_credit"] = "cash"
    terms_accepted: bool = False
    terms_version: str = Field(default="checkout-1405-01", max_length=40)
    discount_code: str | None = Field(default=None, min_length=3, max_length=40)
    combined_selection: CartItemCreate | None = None

    @model_validator(mode="after")
    def validate_combined_selection(self) -> "BookingCreate":
        selection = self.combined_selection
        if selection is None:
            return self
        if selection.item_type != "tour" or selection.combined_departure_price_id is None:
            raise ValueError("a dated combined tour selection is required")
        rooms = selection.room_selection
        expected = {
            "adult": 2 * rooms.get("double", 0) + rooms.get("single", 0) + rooms.get("extra", 0),
            "child": rooms.get("childWithBed", 0) + rooms.get("childWithoutBed", 0),
            "infant": rooms.get("infant", 0),
        }
        if any(sum(p.passenger_type == kind for p in self.passengers) != count for kind, count in expected.items()):
            raise ValueError("passengers do not match the selected rates")
        return self



class BookingItemRead(BookingSchema):
    id: int
    item_type: str
    title_snapshot: str
    details_snapshot: str | None
    price_amount: Decimal | None
    currency: str | None
    hotel_amount: Decimal | None
    hotel_currency: str | None
    flight_amount: Decimal | None
    flight_currency: str | None
    room_selection: dict[str, int]
    tour_id: int | None
    tour_departure_id: int | None
    hotel_package_id: int | None
    tour_hotel_price_id: int | None


class BookingCustomerRead(BookingSchema):
    id: int
    full_name: str
    email: str
    phone: str | None


class BookingTicketRead(BookingSchema):
    id: int
    ticket_number: str
    passenger_index: int
    passenger_type: str
    first_name: str
    last_name: str
    father_name: str | None = None
    first_name_en: str | None = None
    last_name_en: str | None = None
    national_code: str | None = None
    passport_number: str | None = None
    item_type: str
    service_title: str
    route: str
    departure_airport: str | None = None
    arrival_airport: str | None = None
    departure_date: date | None = None
    departure_time: time | None = None
    carrier: str | None = None
    travel_class: str | None = None
    baggage_allowance: str | None = None
    issued_at: datetime


class BookingRead(BookingSchema):
    id: int
    booking_number: str
    status: str
    total_amount: Decimal | None
    payment_method: str = "cash"
    checkout_step: str = "review"
    terms_version: str | None = None
    terms_accepted_at: datetime | None = None
    subtotal_amount: Decimal | None = None
    discount_amount: Decimal = Decimal(0)
    discount_code: str | None = None
    tax_amount: Decimal = Decimal(0)
    service_fee_amount: Decimal = Decimal(0)
    payable_now_amount: Decimal | None = None
    installment_months: int | None = None
    installment_down_payment: Decimal | None = None
    installment_fee_rate: Decimal | None = None
    installment_financed_amount: Decimal | None = None
    installment_total_amount: Decimal | None = None
    installment_monthly_amount: Decimal | None = None
    installment_first_due_date: date | None = None
    installment_status: str | None = None
    currency: str
    customer_note: str | None
    passenger_details: list[BookingPassengerRead] = Field(default_factory=list)
    admin_note: str | None
    reviewed_at: datetime | None
    payment_expires_at: datetime | None = None
    capacity_reserved_at: datetime | None = None
    capacity_released_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[BookingItemRead]
    tickets: list[BookingTicketRead] = Field(default_factory=list)


class AdminBookingRead(BookingRead):
    customer: BookingCustomerRead


class BookingReview(BookingSchema):
    status: Literal["approved", "rejected"]
    admin_note: str | None = Field(default=None, max_length=2000)
    total_amount: Decimal | None = Field(default=None, gt=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def require_approved_total(self) -> "BookingReview":
        if self.status == "approved" and self.total_amount is None:
            raise ValueError("approved bookings require a final payable total")
        return self


class BookingPaymentConfirmation(BookingSchema):
    """Manual settlement confirmation performed by an authorized administrator."""

    admin_note: str | None = Field(default=None, max_length=2000)
