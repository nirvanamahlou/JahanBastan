"""Strict, site-specific control contracts."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.public_origin import public_origin

CONTRACT = "jahan-bastan.nora.v1"
SITE_ID = "jahan-bastan"
RESOURCES = (
    "countries",
    "destinations",
    "tours",
    "hotels",
    "service-offers",
    "editorial-content",
    "exchange-rates",
    "site-analytics",
    "customer-accounts",
    "customer-orders",
)
FUTURE = (
    "central-publication",
    "orders",
    "allocations",
    "contracts",
    "payments",
    "installments",
    "refunds",
    "reservations",
    "holds",
    "procurement",
    "issuance",
    "vouchers",
    "documents",
    "finance",
    "accounting",
)


def origin(value: str, *, local: bool = False) -> str:
    """Validate configured origins without trusting inbound Host headers."""
    return public_origin(value, allow_test_loopback=local)


class StrictModel(BaseModel):
    """Reject unsupported fields rather than silently accepting commands."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class IssueConnection(StrictModel):
    """Site administrator's explicit delegation to Nora."""

    nora_origin: str = Field(default="https://avinaofficial.ir", alias="noraOrigin")
    resources: list[
        Literal[
            "countries",
            "destinations",
            "tours",
            "hotels",
            "service-offers",
            "editorial-content",
            "exchange-rates",
            "site-analytics",
            "customer-accounts",
            "customer-orders",
        ]
    ] = Field(default_factory=lambda: list(RESOURCES), min_length=1, max_length=10)

    @field_validator("nora_origin")
    @classmethod
    def validate_origin(cls, value: str) -> str:
        return origin(value)


class Rotate(StrictModel):
    next_api_key: str = Field(alias="nextApiKey", pattern=r"^[A-Za-z0-9_-]{64}$")


class LifecycleCommand(StrictModel):
    expected_version: int = Field(alias="expectedVersion", ge=1)
    operation_id: UUID = Field(alias="operationId")
    action: Literal["disconnect", "delete"]


class WorkbookCommand(StrictModel):
    filename: str = Field(pattern=r"^[^/\\]{1,155}\.xlsx$")
    content: str = Field(max_length=5_592_408)
    apply: bool = False
    tour_id: int | None = Field(default=None, alias="tourId", ge=1)
    proof: str | None = Field(default=None, max_length=64)


class FutureEnvelope(StrictModel):
    """Document-only future envelope. No executable handler accepts it."""

    contract: Literal["jahan-bastan.nora.business.v1"]
    site_id: Literal["jahan-bastan"] = Field(alias="siteId")
    organization_id: UUID = Field(alias="organizationId")
    legal_entity_id: UUID = Field(alias="legalEntityId")
    branch_id: UUID = Field(alias="branchId")
    actor_id: UUID = Field(alias="actorId")
    order_id: str = Field(alias="orderId", max_length=120)
    service_line_id: str = Field(alias="serviceLineId", max_length=120)
    amount: str = Field(pattern=r"^\d{1,24}(\.\d{1,8})?$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    version: int = Field(ge=1)
    event_id: UUID = Field(alias="eventId")
    operation_id: UUID = Field(alias="operationId")
    correlation_id: UUID = Field(alias="correlationId")
    terms_version: str = Field(alias="termsVersion", max_length=80)
    payload: dict[str, Any]
