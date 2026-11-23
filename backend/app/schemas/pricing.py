"""Administrative tour-room bulk price contracts."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

PricingDirection = Literal["increase", "decrease"]


class PricingSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, serialize_by_alias=True
    )


class ExchangeRateWrite(PricingSchema):
    rate_toman: Decimal = Field(gt=0, le=1_000_000_000, decimal_places=0)


class ExchangeRateRead(PricingSchema):
    code: Literal["USD", "EUR"]
    rate_toman: Decimal
    updated_at: datetime
    updated_by_name: str | None = None


class TourRoomOption(PricingSchema):
    id: int
    tour_id: int
    tour_title: str
    hotel_name: str
    room_label: str
    city: str | None
    nights: int
    currency: str
    priced_rates: int


class TourPricingOption(PricingSchema):
    id: int
    title: str
    rooms: list[TourRoomOption]


class BulkPricingOptions(PricingSchema):
    tours: list[TourPricingOption]


class BulkPriceAdjustmentRequest(PricingSchema):
    tour_ids: list[int] = Field(min_length=1, max_length=100)
    room_ids: list[int] = Field(min_length=1, max_length=500)
    direction: PricingDirection
    amount_toman: Decimal = Field(gt=0, le=1_000_000_000_000)

    @field_validator("tour_ids", "room_ids")
    @classmethod
    def unique_positive_ids(cls, value: list[int]) -> list[int]:
        if any(item <= 0 for item in value) or len(value) != len(set(value)):
            raise ValueError("ids must be unique positive numbers")
        return value

    @field_validator("amount_toman")
    @classmethod
    def whole_toman(cls, value: Decimal) -> Decimal:
        if value != value.to_integral_value():
            raise ValueError("amount_toman must be a whole number")
        return value


class BulkPricePreview(PricingSchema):
    target: Literal["tour"]
    direction: PricingDirection
    amount_toman: Decimal
    selected_tours: int
    selected_rooms: int
    eligible_rates: int
    skipped_unpriced: int
    skipped_foreign_currency: int
    blocked_rates: int
    before_total_toman: Decimal
    after_total_toman: Decimal
    can_apply: bool


class BulkPriceAdjustmentRead(BulkPricePreview):
    id: int
    admin_id: int | None
    admin_name: str
    created_at: datetime
