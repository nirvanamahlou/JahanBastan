"""Public payment and future CRM-settlement contracts."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class PaymentSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class PaymentConfiguration(PaymentSchema):
    enabled: bool
    provider: str | None = None
    message: str


class PaymentIntentCreate(PaymentSchema):
    crm_contract_number: str = Field(min_length=2, max_length=128)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=0)
    currency: Literal["IRR", "IRT", "USD", "EUR", "TRY", "GEL"] = "IRT"
    description: str | None = Field(default=None, max_length=500)


class PaymentIntentRead(PaymentSchema):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    crm_contract_number: str
    amount: Decimal
    currency: str
    status: str
    provider: str | None
    refunded_amount: Decimal = Decimal(0)
    created_at: datetime
    checkout_url: str | None = None


class WalletTopUpCreate(PaymentSchema):
    """The customer may choose an amount, never the account or paid status."""

    amount: Decimal = Field(ge=10_000, le=500_000_000, max_digits=14, decimal_places=0)
    currency: Literal["IRR"] = "IRR"


class WalletTopUpRead(PaymentSchema):
    id: int
    reference: str
    amount: Decimal
    currency: str
    status: str
    provider: str | None
    created_at: datetime
    checkout_url: str | None = None
