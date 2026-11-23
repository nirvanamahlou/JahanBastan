"""Public customer account contracts."""

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

from app.schemas.support import SupportMessageRead


class AccountSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class AgencyRegistration(AccountSchema):
    legal_name: str = Field(min_length=2, max_length=180)
    registration_number: str = Field(min_length=2, max_length=64)
    national_id: str | None = Field(default=None, min_length=5, max_length=32)
    economic_code: str | None = Field(default=None, min_length=5, max_length=32)
    license_number: str = Field(min_length=2, max_length=64)
    manager_name: str = Field(min_length=2, max_length=120)
    manager_national_code: str = Field(min_length=8, max_length=16)
    phone: str = Field(min_length=8, max_length=32)
    province: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    address: str = Field(min_length=5, max_length=1000)
    postal_code: str | None = Field(default=None, max_length=20)

    @field_validator("legal_name", "manager_name", "province", "city", "address")
    @classmethod
    def normalize_agency_text(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator(
        "registration_number",
        "license_number",
        "manager_national_code",
        "phone",
    )
    @classmethod
    def normalize_required_agency_identifier(cls, value: str) -> str:
        normalized = "".join(value.split()).upper()
        if not normalized:
            raise ValueError("identifier cannot be empty")
        return normalized

    @field_validator("national_id", "economic_code", "postal_code", mode="before")
    @classmethod
    def normalize_optional_agency_identifier(cls, value: str | None) -> str | None:
        return "".join(str(value).split()).upper() if value else None

    @model_validator(mode="after")
    def require_business_identifier(self) -> "AgencyRegistration":
        if not self.national_id and not self.economic_code:
            raise ValueError("national_id or economic_code is required")
        return self


class CustomerRegistration(AccountSchema):
    account_type: Literal["customer", "agency"] = "customer"
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(
        min_length=8,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    remember_me: bool = False
    agency: AgencyRegistration | None = None

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return " ".join(value.split())

    @model_validator(mode="after")
    def require_agency_details(self) -> "CustomerRegistration":
        if self.account_type == "agency" and self.agency is None:
            raise ValueError("agency details are required for an agency account")
        if self.account_type == "customer" and self.agency is not None:
            raise ValueError("agency details are only accepted for an agency account")
        return self


class CustomerLogin(AccountSchema):
    account_type: Literal["customer", "agency"] = "customer"
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    remember_me: bool = False


class PasswordResetRequest(AccountSchema):
    email: EmailStr


class PasswordResetRequestResponse(AccountSchema):
    message: str
    # Exposed only by the local development environment, never in production.
    reset_url: str | None = None


class PasswordResetConfirm(AccountSchema):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(
        min_length=8,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )


class CustomerSmsLoginRequest(AccountSchema):
    phone: str = Field(min_length=8, max_length=32)
    remember_me: bool = True

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        normalized = "".join(
            str(int(character)) if character.isdigit() else character
            for character in value
            if character.isdigit() or character == "+"
        )
        if normalized.startswith("0098"):
            normalized = f"+98{normalized[4:]}"
        elif normalized.startswith("09") and len(normalized) == 11:
            normalized = f"+98{normalized[1:]}"
        elif normalized.startswith("9") and len(normalized) == 10:
            normalized = f"+98{normalized}"
        if not normalized.startswith("+") or len(normalized[1:]) < 10:
            raise ValueError("invalid phone number")
        return normalized


class CustomerSmsLoginVerify(CustomerSmsLoginRequest):
    code: str = Field(min_length=4, max_length=10)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = "".join(
            str(int(character)) for character in value if character.isdigit()
        )
        if len(normalized) != 6:
            raise ValueError("SMS code must contain exactly six digits")
        return normalized


class CustomerAccount(AccountSchema):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    account_type: Literal["customer", "agency"] = "customer"
    email: EmailStr
    full_name: str
    phone: str | None = None
    emergency_phone: str | None = None
    buyer_mobile: str | None = None
    landline: str | None = None
    postal_code: str | None = None
    national_code: str | None = None
    birth_date: date | None = None
    address: str | None = None
    bank_iban: str | None = None
    bank_account_number: str | None = None
    bank_card_last4: str | None = None
    created_at: datetime


class CustomerAuthentication(AccountSchema):
    user: CustomerAccount


class CustomerAccountUpdate(AccountSchema):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    emergency_phone: str | None = Field(default=None, max_length=32)
    buyer_mobile: str | None = Field(default=None, max_length=32)
    landline: str | None = Field(default=None, max_length=32)
    postal_code: str | None = Field(default=None, max_length=20)
    national_code: str | None = Field(default=None, max_length=16)
    birth_date: date | None = None
    address: str | None = Field(default=None, max_length=1000)
    bank_iban: str | None = Field(default=None, max_length=34)
    bank_account_number: str | None = Field(default=None, max_length=64)
    bank_card_number: str | None = Field(
        default=None,
        max_length=32,
        json_schema_extra={"writeOnly": True},
    )

    @field_validator("birth_date", mode="before")
    @classmethod
    def normalize_optional_date(cls, value: Any) -> Any:
        return None if value == "" else value

    @field_validator("full_name")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value

    @field_validator("phone", "emergency_phone", "national_code", "bank_iban")
    @classmethod
    def normalize_identifier(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return "".join(value.split()).upper() or None

    @field_validator("bank_account_number")
    @classmethod
    def normalize_account_number(cls, value: str | None) -> str | None:
        return "".join(value.split()) if value else None

    @field_validator("bank_card_number", mode="before")
    @classmethod
    def validate_card_number(cls, value: Any) -> str | None:
        if value is None:
            return None
        normalized = "".join(
            character for character in str(value) if character.isdigit()
        )
        if not normalized:
            return None
        if len(normalized) < 4:
            raise ValueError("card number must contain at least four digits")
        if len(normalized) > 32:
            raise ValueError("card number must contain at most 32 digits")
        return normalized


class CustomerWalletRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    available_credit: Decimal
    currency: str


class AgencyProfileRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    legal_name: str
    registration_number: str
    national_id: str | None = None
    economic_code: str | None = None
    license_number: str
    manager_name: str
    manager_national_code: str
    phone: str
    province: str
    city: str
    address: str
    postal_code: str | None = None
    status: Literal["pending", "approved", "rejected"]
    credit_limit: Decimal
    credit_used: Decimal
    credit_reserved: Decimal
    available_credit: Decimal
    currency: str
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


def minimum_passport_expiry_date(reference: date | None = None) -> date:
    """Return the earliest passport expiry accepted for a new booking."""
    today = reference or date.today()
    month_index = today.month - 1 + 4
    year = today.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(today.day, monthrange(year, month)[1]))


class CustomerPassengerWrite(AccountSchema):
    """Validated reusable traveler information for a customer account."""

    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    last_name: str | None = Field(default=None, min_length=1, max_length=60)
    father_name: str | None = Field(default=None, min_length=1, max_length=60)
    first_name_en: str | None = Field(default=None, min_length=1, max_length=60)
    last_name_en: str | None = Field(default=None, min_length=1, max_length=60)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    national_code: str | None = Field(default=None, max_length=16)
    passport_number: str | None = Field(default=None, max_length=32)
    passport_expiry_date: date | None = None
    email: EmailStr | None = None
    gender: Literal["male", "female", "unspecified"] = "unspecified"
    age: int | None = Field(default=None, ge=0, le=120)
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=32)
    has_pet: bool = False
    pet_name: str | None = Field(default=None, max_length=80)
    pet_type: str | None = Field(default=None, max_length=80)
    pet_weight_kg: Decimal | None = Field(default=None, gt=0, le=100)
    is_default: bool = False

    @field_validator("first_name", "last_name", "father_name", "full_name")
    @classmethod
    def normalize_passenger_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else None

    @field_validator("first_name_en", "last_name_en")
    @classmethod
    def normalize_english_passenger_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else None

    @field_validator("national_code", "passport_number", "phone")
    @classmethod
    def normalize_passenger_identifier(cls, value: str | None) -> str | None:
        return "".join(value.split()).upper() if value else None

    @model_validator(mode="after")
    def populate_separate_persian_names(self) -> "CustomerPassengerWrite":
        """Keep legacy full-name clients working while storing split name fields."""
        if (not self.first_name or not self.last_name) and self.full_name:
            parts = self.full_name.split()
            if len(parts) >= 2:
                self.first_name = self.first_name or parts[0]
                self.last_name = self.last_name or " ".join(parts[1:])
        if not self.first_name or not self.last_name:
            raise ValueError("first_name and last_name are required")
        if self.birth_date is None:
            raise ValueError("birth_date is required")
        if self.gender == "unspecified":
            raise ValueError("gender is required")
        if not self.national_code and not self.passport_number:
            raise ValueError("national_code or passport_number is required")
        if self.passport_number and (not self.first_name_en or not self.last_name_en):
            raise ValueError(
                "first_name_en and last_name_en are required for passport travelers"
            )
        self.full_name = f"{self.first_name} {self.last_name}"
        if self.passport_number and not self.passport_expiry_date:
            raise ValueError(
                "passport expiry date is required when a passport number is provided"
            )
        if (
            self.passport_expiry_date
            and self.passport_expiry_date < minimum_passport_expiry_date()
        ):
            raise ValueError(
                "passport expiry date must be at least four months from today"
            )
        if self.has_pet and (not self.pet_type or self.pet_weight_kg is None):
            raise ValueError(
                "pet_type and pet_weight_kg are required when has_pet is true"
            )
        if not self.has_pet:
            self.pet_name = None
            self.pet_type = None
            self.pet_weight_kg = None
        return self


class CustomerPassengerRead(AccountSchema):
    """Stored traveler data; expired passports remain readable for checkout warnings."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    first_name: str | None
    last_name: str | None
    father_name: str | None
    first_name_en: str | None
    last_name_en: str | None
    full_name: str
    national_code: str | None
    passport_number: str | None
    passport_expiry_date: date | None
    email: EmailStr | None
    gender: Literal["male", "female", "unspecified"]
    age: int | None
    birth_date: date | None
    phone: str | None
    has_pet: bool
    pet_name: str | None
    pet_type: str | None
    pet_weight_kg: Decimal | None
    is_default: bool
    created_at: datetime


class CustomerInsuranceWrite(AccountSchema):
    provider: str = Field(min_length=2, max_length=120)
    policy_number: str = Field(min_length=2, max_length=80)
    coverage_title: str = Field(min_length=2, max_length=160)
    coverage_amount: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    start_date: date
    end_date: date
    status: Literal["active", "pending", "expired", "cancelled"] = "active"

    @field_validator("provider", "policy_number", "coverage_title")
    @classmethod
    def normalize_insurance_text(cls, value: str) -> str:
        return " ".join(value.split())

    @model_validator(mode="after")
    def validate_insurance_dates(self) -> "CustomerInsuranceWrite":
        if self.end_date < self.start_date:
            raise ValueError("insurance end_date must not precede start_date")
        return self


class CustomerInsuranceRead(CustomerInsuranceWrite):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    created_at: datetime


class CustomerSupportRequestCreate(AccountSchema):
    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=4000)

    @field_validator("subject", "message")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class CustomerSupportRequestRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    subject: str
    message: str
    status: Literal["open", "in_progress", "closed"]
    created_at: datetime
    updated_at: datetime
    messages: list[SupportMessageRead] = Field(default_factory=list)


class CustomerOrderServiceRead(AccountSchema):
    """Stable booking-service snapshot for the customer travel history."""

    title: str
    details: str | None = None


class CustomerOrderRead(AccountSchema):
    id: int
    order_number: str
    title: str | None = None
    amount: Decimal
    currency: str
    status: str
    created_at: datetime
    updated_at: datetime | None = None
    service_items: list[CustomerOrderServiceRead] = Field(default_factory=list)
    passenger_count: int = 0
    source: Literal["payment", "booking"] = "payment"
    payment_expires_at: datetime | None = None
    tickets_issued: bool = False


class AvailabilityAlertCreate(AccountSchema):
    service_type: str = Field(pattern="^(flight|train|bus)$")
    origin: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=120)
    departure_date: date


class AvailabilityAlertRead(AvailabilityAlertCreate):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    is_active: bool
    created_at: datetime


class CartItemCreate(AccountSchema):
    item_type: Literal["tour", "flight", "train", "bus"]
    tour_id: int | None = Field(default=None, gt=0)
    travel_service_id: int | None = Field(default=None, gt=0)
    tour_departure_id: int | None = Field(default=None, gt=0)
    hotel_package_id: int | None = Field(default=None, gt=0)
    tour_hotel_price_id: int | None = Field(default=None, gt=0)
    combined_departure_price_id: int | None = Field(default=None, gt=0)
    room_selection: dict[
        Literal[
            "double", "single", "extra", "childWithBed", "childWithoutBed", "infant"
        ],
        int,
    ] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_source(self) -> "CartItemCreate":
        if self.item_type == "tour":
            valid_rooms = (
                self.room_selection
                and all(
                    0 <= quantity <= 20 for quantity in self.room_selection.values()
                )
                and any(quantity > 0 for quantity in self.room_selection.values())
            )
            if (
                self.tour_id is None
                or self.travel_service_id is not None
                or self.tour_departure_id is None
                or (
                    self.tour_hotel_price_id is None
                    and self.combined_departure_price_id is None
                )
                or (
                    self.tour_hotel_price_id is not None
                    and self.combined_departure_price_id is not None
                )
                or not valid_rooms
            ):
                raise ValueError(
                    "a tour item requires a departure, hotel offer and room selection"
                )
        if self.item_type in {"flight", "train", "bus"} and (
            self.travel_service_id is None
            or self.tour_id is not None
            or self.tour_departure_id is not None
            or self.hotel_package_id is not None
            or self.tour_hotel_price_id is not None
            or self.combined_departure_price_id is not None
            or self.room_selection
        ):
            raise ValueError("a transport item requires only travel_service_id")
        return self


class CartItemRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    item_type: str
    tour_id: int | None
    travel_service_id: int | None
    tour_departure_id: int | None
    hotel_package_id: int | None
    tour_hotel_price_id: int | None
    combined_departure_price_id: int | None
    room_selection: dict[str, int]
    title_snapshot: str
    details_snapshot: str | None
    price_amount: Decimal | None
    currency: str | None
    hotel_amount: Decimal | None
    hotel_currency: str | None
    flight_amount: Decimal | None
    flight_currency: str | None
    image_id: int | None
    status: str
    price_checked_at: datetime | None
    expires_at: datetime | None
    current_price_amount: Decimal | None
    current_currency: str | None
    current_hotel_amount: Decimal | None
    current_hotel_currency: str | None
    current_flight_amount: Decimal | None
    current_flight_currency: str | None
    product_snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CartEventRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    cart_item_id: int | None
    actor_type: str
    actor_id: int | None
    event_type: str
    note: str | None
    payload: dict[str, Any]
    created_at: datetime


class CartSummaryRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    status: str
    currency: str
    subtotal_amount: Decimal | None
    discount_amount: Decimal
    total_amount: Decimal | None
    expires_at: datetime | None
    last_activity_at: datetime
    converted_booking_id: int | None
    assigned_admin_id: int | None
    created_at: datetime
    updated_at: datetime
    items: list[CartItemRead] = Field(default_factory=list)
    events: list[CartEventRead] = Field(default_factory=list)


class CartPriceAcceptance(AccountSchema):
    item_ids: list[int] = Field(default_factory=list, max_length=30)


class CartConsultationCreate(AccountSchema):
    message: str | None = Field(default=None, max_length=1000)


class CartAdminFollowUp(AccountSchema):
    note: str = Field(default="پیگیری سبد", min_length=1, max_length=500)


class CartAdminHoldExtension(AccountSchema):
    minutes: int = Field(default=120, ge=15, le=1440)


class CartAdminReminder(AccountSchema):
    message: str | None = Field(default=None, max_length=500)


class AdminCartCustomerRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    full_name: str
    email: str
    phone: str | None
    last_login_at: datetime | None = None


class AdminCartPassengerRead(AccountSchema):
    """A deliberately limited passenger view for the sales workspace."""

    full_name: str
    passenger_type: str
    age: int | None = None
    national_code_masked: str | None = None
    passport_number_masked: str | None = None
    documents_complete: bool


class AdminCartBookingRead(AccountSchema):
    id: int
    booking_number: str
    status: str
    currency: str
    subtotal_amount: Decimal | None = None
    discount_amount: Decimal = Decimal(0)
    discount_code: str | None = None
    tax_amount: Decimal = Decimal(0)
    service_fee_amount: Decimal = Decimal(0)
    total_amount: Decimal | None = None
    payable_now_amount: Decimal | None = None
    payment_method: str
    payment_expires_at: datetime | None = None
    paid_at: datetime | None = None
    capacity_reserved_at: datetime | None = None
    capacity_released_at: datetime | None = None
    customer_note: str | None = None
    admin_note: str | None = None
    passengers: list[AdminCartPassengerRead] = Field(default_factory=list)
    documents_pending: int = 0


class AdminCartPaymentRead(AccountSchema):
    id: int
    amount: Decimal
    currency: str
    status: str
    provider: str | None = None
    provider_reference: str | None = None
    verified_at: datetime | None = None
    failure_reason: str | None = None
    refunded_amount: Decimal = Decimal(0)
    created_at: datetime


class AdminCartRead(CartSummaryRead):
    customer: AdminCartCustomerRead
    operational_status: str
    booking: AdminCartBookingRead | None = None
    payments: list[AdminCartPaymentRead] = Field(default_factory=list)
    paid_amount: Decimal = Decimal(0)
    remaining_amount: Decimal | None = None
    destinations: list[str] = Field(default_factory=list)
    travel_dates: list[date] = Field(default_factory=list)
    capacity_summary: list[str] = Field(default_factory=list)
    alerts: list[str] = Field(default_factory=list)


class SavedTourRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)

    id: int
    tour_id: int
    title: str
    slug: str
    image_id: int | None
    price_amount: Decimal | None
    currency: str
    created_at: datetime


class CustomerDashboard(AccountSchema):
    user: CustomerAccount
    wallet: CustomerWalletRead
    agency: AgencyProfileRead | None = None
    cart_items: list[CartItemRead]
    saved_tours: list[SavedTourRead]
    recent_orders: list[CustomerOrderRead]


VisaType = Literal["tourist", "business", "exhibition", "residency", "student"]
VisaApplicationStatus = Literal[
    "draft", "pending_review", "needs_documents", "approved", "rejected"
]


class VisaApplicationCreate(AccountSchema):
    travel_service_id: int = Field(gt=0)


class VisaApplicationDocumentRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)
    id: int
    original_name: str
    document_type: str
    mime_type: str
    byte_size: int
    created_at: datetime


class VisaApplicationServiceRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)
    id: int
    title: str
    slug: str
    country: str | None
    visa_type: VisaType | None
    base_price: Decimal | None
    currency: str
    visa_form_url: str | None
    visa_document_requirements: list[str]


class VisaApplicationCustomerRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)
    id: int
    full_name: str
    email: EmailStr
    phone: str | None


class VisaApplicationRead(AccountSchema):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel)
    id: int
    status: VisaApplicationStatus
    customer_message: str | None
    created_at: datetime
    updated_at: datetime
    travel_service: VisaApplicationServiceRead
    documents: list[VisaApplicationDocumentRead]


class VisaApplicationAdminRead(VisaApplicationRead):
    internal_note: str | None
    reviewed_by_admin_id: int | None
    customer: VisaApplicationCustomerRead


class VisaApplicationStatusUpdate(AccountSchema):
    status: VisaApplicationStatus
    customer_message: str | None = Field(default=None, max_length=5000)
    internal_note: str | None = Field(default=None, max_length=5000)
