"""Admin authentication and user-management schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

AdminRole = Literal["super_admin", "admin", "editor"]


class AdminSchema(BaseModel):
    """Shared camelCase API serialization policy."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class LoginRequest(AdminSchema):
    """Administrative login credentials."""

    email: EmailStr = Field(description="Administrative account email.")
    password: str = Field(
        min_length=12,
        max_length=128,
        description="Administrative account password.",
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    mfa_code: str | None = Field(
        default=None, min_length=6, max_length=6, pattern=r"^[0-9]{6}$"
    )


class AdminPasswordResetRequest(AdminSchema):
    """Request a password-recovery code for an administrative account."""

    email: EmailStr


class AdminPasswordResetConfirm(AdminSchema):
    """Verify a short-lived recovery code and choose a new administrator password."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")
    password: str = Field(
        min_length=12,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )


class AdminPasswordChangeRequest(AdminSchema):
    """Credentials required for an administrator to change their own password."""

    email: EmailStr = Field(
        description="Username (email) of the current administrator."
    )
    current_password: str = Field(
        min_length=12,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    new_password: str = Field(
        min_length=12,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )

    @model_validator(mode="after")
    def require_different_new_password(self) -> "AdminPasswordChangeRequest":
        if self.current_password == self.new_password:
            raise ValueError("new password must differ from current password")
        return self


class AdminMfaStatus(AdminSchema):
    enabled: bool
    required: bool


class AdminMfaSetupResponse(AdminSchema):
    secret: str
    provisioning_uri: str


class AdminMfaCodeRequest(AdminSchema):
    code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class AdminMfaDisableRequest(AdminMfaCodeRequest):
    password: str = Field(
        min_length=12,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )


class AdminUserCreate(AdminSchema):
    """Fields accepted when creating an administrative account."""

    email: EmailStr = Field(description="Unique administrative account email.")
    full_name: str = Field(
        min_length=2,
        max_length=120,
        description="Human-readable administrator name.",
    )
    password: str = Field(
        min_length=12,
        max_length=128,
        description="Initial password; accepted only as write-only input.",
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    role: AdminRole = Field(
        default="editor",
        description="Authorization role assigned to the account.",
    )

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        """Trim repeated surrounding whitespace."""
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("full name must contain at least two characters")
        return normalized


class AdminUserUpdate(AdminSchema):
    """Mutable administrative account fields."""

    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
        description="Updated human-readable name.",
    )
    password: str | None = Field(
        default=None,
        min_length=12,
        max_length=128,
        description="Replacement password; revokes existing sessions.",
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    role: AdminRole | None = Field(
        default=None,
        description="Replacement authorization role.",
    )
    is_active: bool | None = Field(
        default=None,
        description="Whether this administrator may authenticate.",
    )
    can_manage_pricing: bool | None = None


class AdminUserResponse(AdminSchema):
    """Safe administrative account representation."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int = Field(description="Stable administrator identifier.")
    email: EmailStr = Field(description="Administrative account email.")
    full_name: str = Field(description="Human-readable administrator name.")
    role: AdminRole = Field(description="Effective authorization role.")
    can_manage_pricing: bool = False
    is_active: bool = Field(description="Whether authentication is allowed.")
    last_login_at: datetime | None = Field(
        description="Timestamp of the last successful login."
    )
    created_at: datetime = Field(description="Account creation timestamp.")
    updated_at: datetime = Field(description="Last account update timestamp.")


class AdminUserListResponse(AdminSchema):
    """Paginated administrative account collection."""

    items: list[AdminUserResponse] = Field(description="Current bounded page.")
    total: int = Field(description="Total matching administrator count.")
    limit: int = Field(description="Maximum records returned.")
    offset: int = Field(description="Zero-based result offset.")


class AuthenticationResponse(AdminSchema):
    """Successful login or session lookup response."""

    user: AdminUserResponse = Field(description="Authenticated administrative account.")


class CustomerUserResponse(AdminSchema):
    """Privacy-minimised customer account representation for super admins."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    email: EmailStr
    full_name: str
    account_type: Literal["customer", "agency"] = "customer"
    phone: str | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class CustomerUserListResponse(AdminSchema):
    """Paginated customer account collection."""

    items: list[CustomerUserResponse]
    total: int
    limit: int
    offset: int


class CustomerFilePassengerRead(AdminSchema):
    """Reusable passenger data included in a single customer file."""

    id: int
    full_name: str
    first_name_en: str | None = None
    last_name_en: str | None = None
    father_name: str | None = None
    national_code: str | None = None
    passport_number: str | None = None
    passport_expiry_date: date | None = None
    birth_date: date | None = None
    gender: str
    phone: str | None = None
    email: EmailStr | None = None
    is_default: bool


class CustomerFileBookingRead(AdminSchema):
    """A concise, non-editable reservation record for an administrator."""

    id: int
    booking_number: str
    status: str
    service_titles: list[str]
    total_amount: Decimal | None = None
    currency: str
    payment_method: str
    passenger_count: int
    ticket_count: int
    document_count: int
    created_at: datetime
    payment_expires_at: datetime | None = None


class CustomerFileTicketRead(AdminSchema):
    ticket_number: str
    passenger_name: str
    passenger_type: str
    item_type: str
    service_title: str
    route: str
    departure_airport: str | None = None
    arrival_airport: str | None = None
    departure_date: date | None = None
    departure_time: str | None = None
    carrier: str | None = None
    travel_class: str | None = None
    baggage_allowance: str | None = None
    issued_at: datetime


class CustomerFileDocumentRead(AdminSchema):
    id: int
    booking_number: str
    passenger_name: str | None = None
    original_name: str
    mime_type: str
    byte_size: int
    status: str
    review_note: str | None = None
    created_at: datetime


class CustomerFilePaymentRead(AdminSchema):
    crm_contract_number: str
    amount: Decimal
    currency: str
    status: str
    provider: str | None = None
    provider_reference: str | None = None
    verified_at: datetime | None = None
    created_at: datetime


class CustomerFileVisaApplicationRead(AdminSchema):
    id: int
    service_title: str
    status: str
    document_count: int
    created_at: datetime
    updated_at: datetime


class CustomerFileRead(AdminSchema):
    """Complete support file for one customer; never contains passwords or bank data."""

    id: int
    full_name: str
    email: EmailStr
    phone: str | None = None
    emergency_phone: str | None = None
    national_code: str | None = None
    birth_date: date | None = None
    address: str | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    wallet_credit: Decimal = Decimal(0)
    wallet_currency: str = "IRR"
    support_request_count: int = 0
    passengers: list[CustomerFilePassengerRead]
    bookings: list[CustomerFileBookingRead]
    tickets: list[CustomerFileTicketRead]
    documents: list[CustomerFileDocumentRead]
    payments: list[CustomerFilePaymentRead]
    visa_applications: list[CustomerFileVisaApplicationRead]
