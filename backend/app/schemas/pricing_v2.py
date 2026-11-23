"""Versioned contracts for multi-target bulk price management."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.pricing import PricingSchema

Target = Literal["tour", "hotels", "city", "ticket"]
Calculation = Literal["percentage", "fixed"]
Direction = Literal["increase", "decrease"]
AdjustmentCurrency = Literal["IRT", "EUR", "USD"]
PriceField = Literal[
    "tour_base",
    "tour_flight",
    "extra_flight",
    "double_flight",
    "single_flight",
    "extra",
    "double",
    "single",
    "child_with_bed",
    "child_with_bed_flight",
    "child_without_bed",
    "infant",
    "hotel_base",
    "hotel_child_with_bed",
    "hotel_child_without_bed",
    "hotel_infant",
    "ticket_base",
]


class PricingOption(PricingSchema):
    id: int
    label: str
    subtitle: str | None = None


class BulkPricingV2Options(PricingSchema):
    tours: list[PricingOption]
    hotels: list[PricingOption]
    cities: list[str]
    tickets: list[PricingOption]


class PricingDepartureOption(PricingOption):
    nights: int | None = None
    departure_date: date | None = None
    return_date: date | None = None


class BulkPriceV2Request(PricingSchema):
    target: Target
    tour_ids: list[int] = Field(default_factory=list, max_length=100)
    departure_id: int | None = Field(default=None, gt=0)
    hotel_ids: list[int] = Field(default_factory=list, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    ticket_ids: list[int] = Field(default_factory=list, max_length=500)
    price_fields: list[PriceField] = Field(min_length=1, max_length=20)
    direction: Direction
    calculation: Calculation
    currency: AdjustmentCurrency | None = None
    value: Decimal = Field(gt=0, le=1_000_000_000_000)

    @model_validator(mode="after")
    def validate_scope(self) -> "BulkPriceV2Request":
        for values in (self.tour_ids, self.hotel_ids, self.ticket_ids):
            if any(value <= 0 for value in values) or len(values) != len(set(values)):
                raise ValueError("ids must be unique positive numbers")
        selected = {
            "tour": bool(self.tour_ids),
            "hotels": bool(self.hotel_ids),
            "city": bool(self.city and self.city.strip()),
            "ticket": bool(self.ticket_ids),
        }
        if not selected[self.target]:
            raise ValueError("target selection is required")
        if self.target == "tour":
            if len(self.tour_ids) != 1 or self.departure_id is None:
                raise ValueError("one tour and its departure are required")
        elif self.departure_id is not None:
            raise ValueError("departure selection is only valid for tours")
        if {"extra_flight", "tour_flight"}.issubset(self.price_fields):
            raise ValueError("shared and extra flight cannot be changed together")
        allowed = {
            "tour": {
                "tour_base",
                "tour_flight",
                "extra_flight",
                "double_flight",
                "single_flight",
                "extra",
                "double",
                "single",
                "child_with_bed",
                "child_with_bed_flight",
                "child_without_bed",
                "infant",
            },
            "hotels": {
                "hotel_base",
                "hotel_child_with_bed",
                "hotel_child_without_bed",
                "hotel_infant",
            },
            "city": {
                "hotel_base",
                "hotel_child_with_bed",
                "hotel_child_without_bed",
                "hotel_infant",
            },
            "ticket": {"ticket_base"},
        }
        if not set(self.price_fields).issubset(allowed[self.target]):
            raise ValueError("invalid price field for target")
        if self.currency is not None and self.target != "tour":
            raise ValueError("currency selection is only valid for tour rates")
        if self.target == "tour" and self.currency in {"EUR", "USD"}:
            hotel_fields = {
                "extra",
                "double",
                "single",
                "child_with_bed",
                "child_without_bed",
                "infant",
            }
            if not set(self.price_fields).issubset(hotel_fields):
                raise ValueError("foreign currencies are only valid for hotel rates")
        if self.target == "tour" and self.currency == "IRT":
            toman_fields = {
                "extra",
                "double",
                "single",
                "child_with_bed",
                "tour_flight",
                "extra_flight",
                "double_flight",
                "single_flight",
                "child_with_bed_flight",
                "child_without_bed",
                "infant",
            }
            if not set(self.price_fields).issubset(toman_fields):
                raise ValueError("invalid toman tour price field")
        if self.calculation == "percentage" and self.value > 1000:
            raise ValueError("percentage cannot exceed 1000")
        if (
            self.calculation == "fixed"
            and self.currency in {None, "IRT"}
            and self.value != self.value.to_integral_value()
        ):
            raise ValueError("fixed toman value must be whole")
        return self


class BulkPriceV2Preview(PricingSchema):
    target: Target
    direction: Direction
    calculation: Calculation
    value: Decimal
    selected_items: int
    eligible_rates: int
    skipped_unpriced: int
    skipped_foreign_currency: int
    blocked_rates: int
    before_total_toman: Decimal
    after_total_toman: Decimal
    can_apply: bool
