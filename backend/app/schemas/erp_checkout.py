"""Contracts for draft-only Avina ERP flight checkout."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ErpCheckoutSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, serialize_by_alias=True
    )


class ErpFlightCapacityCheck(ErpCheckoutSchema):
    product_ids: list[str] = Field(min_length=1, max_length=2)
    birth_dates: list[date] = Field(min_length=1, max_length=30)


class ErpFlightCheckoutCreate(ErpCheckoutSchema):
    product_ids: list[str] = Field(min_length=1, max_length=2)
    passenger_ids: list[int] = Field(min_length=1, max_length=30)
    quote_version: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class ErpFlightQuoteLine(ErpCheckoutSchema):
    currency_code: str
    amount: str
    category: Literal["ADT", "CHD", "INF"] | None = None
    coverage: Literal["one_way", "round_trip"] | None = None
    leg: int | None = None


class ErpFlightQuoteReview(ErpCheckoutSchema):
    quote_version: str
    totals: list[ErpFlightQuoteLine]
    fares: list[ErpFlightQuoteLine]
    identity_checked: bool = False


class ErpFlightSettlement(ErpCheckoutSchema):
    state: Literal["settled", "unpaid", "cancelled"]


class ErpFlightCheckoutRead(ErpCheckoutSchema):
    id: UUID
    state: Literal[
        "received",
        "preparing",
        "prepared",
        "dispatching",
        "uncertain",
        "draft",
        "cancelled",
        "failed",
    ]
    contract_number: str | None = None
    erp_status: str | None = None
    route_label: str | None = None
    payment_enabled: Literal[False] = False
    payment_message: str = "درگاه پرداخت هنوز فعال نشده است."
    retryable: bool = False
    message: str | None = None
    error_code: str | None = None
    created_at: datetime
    updated_at: datetime
