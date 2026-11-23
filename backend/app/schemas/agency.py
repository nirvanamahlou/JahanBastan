"""Administrative agency approval contracts."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


class AgencySchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class AgencyAdminRead(AgencySchema):
    id: int
    customer_id: int
    account_email: EmailStr
    account_full_name: str
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
    updated_at: datetime


class AgencyReview(AgencySchema):
    status: Literal["approved", "rejected"]
    credit_limit: Decimal = Field(default=Decimal(0), ge=0, le=10**14 - 1)
    review_note: str | None = Field(default=None, max_length=1000)
