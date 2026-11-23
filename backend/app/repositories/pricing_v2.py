"""Atomic multi-target bulk pricing with preview and audit snapshots."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import case, distinct, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models import (
    BulkPriceAdjustment,
    Hotel,
    Tour,
    TourCombinedDeparturePrice,
    TourDeparture,
    TourDepartureHotelPrice,
    TravelService,
)
from app.schemas.pricing_v2 import (
    BulkPriceV2Preview,
    BulkPriceV2Request,
    BulkPricingV2Options,
    PricingDepartureOption,
    PricingOption,
)

LOCAL_CURRENCIES = ("IRT", "IRR")


@dataclass(frozen=True)
class FieldSpec:
    model: type[Any]
    price: InstrumentedAttribute[Any]
    currency: ColumnElement[Any]
    fallback: ColumnElement[Any] | None = None
    preserve_inherited_flights: bool = False

    @property
    def effective_price(self) -> ColumnElement[Any]:
        return (
            func.coalesce(self.price, self.fallback)
            if self.fallback is not None
            else self.price
        )


FIELD_SPECS = {
    "tour_base": FieldSpec(
        TourDeparture, TourDeparture.price_amount, TourDeparture.currency
    ),
    "tour_flight": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.flight_price_per_person,
        TourDepartureHotelPrice.flight_currency,
    ),
    "extra": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.extra_price,
        TourDepartureHotelPrice.extra_currency,
    ),
    "double": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.double_price,
        func.coalesce(
            TourDepartureHotelPrice.double_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    "single": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.single_price,
        func.coalesce(
            TourDepartureHotelPrice.single_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    "child_with_bed": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.child_with_bed_price,
        func.coalesce(
            TourDepartureHotelPrice.child_with_bed_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    "child_with_bed_flight": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.child_with_bed_flight_price,
        TourDepartureHotelPrice.child_with_bed_flight_currency,
    ),
    "child_without_bed": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.child_without_bed_price,
        TourDepartureHotelPrice.child_without_bed_currency,
    ),
    "infant": FieldSpec(
        TourDepartureHotelPrice,
        TourDepartureHotelPrice.infant_price,
        TourDepartureHotelPrice.infant_currency,
    ),
    "hotel_base": FieldSpec(Hotel, Hotel.base_price, Hotel.currency),
    "hotel_child_with_bed": FieldSpec(
        Hotel, Hotel.child_with_bed_price, Hotel.currency
    ),
    "hotel_child_without_bed": FieldSpec(
        Hotel, Hotel.child_without_bed_price, Hotel.currency
    ),
    "hotel_infant": FieldSpec(Hotel, Hotel.infant_price, Hotel.currency),
    "ticket_base": FieldSpec(
        TravelService, TravelService.base_price, TravelService.currency
    ),
}


for occupancy in ("double", "single"):
    FIELD_SPECS[f"{occupancy}_flight"] = FieldSpec(
        TourDepartureHotelPrice,
        getattr(TourDepartureHotelPrice, f"{occupancy}_flight_price"),
        TourDepartureHotelPrice.flight_currency,
        TourDepartureHotelPrice.flight_price_per_person,
    )

COMBINED_FIELD_SPECS = {
    f"{occupancy}_flight": FieldSpec(
        TourCombinedDeparturePrice,
        getattr(TourCombinedDeparturePrice, f"{occupancy}_flight_price"),
        TourCombinedDeparturePrice.regular_flight_currency,
        TourCombinedDeparturePrice.regular_flight_price,
    )
    for occupancy in ("double", "single")
}

for name, price_field, currency_field in (
    ("extra", "extra_price", "extra_currency"),
    ("double", "double_price", "double_currency"),
    ("single", "single_price", "single_currency"),
    ("child_with_bed", "child_with_bed_price", "child_with_bed_currency"),
    ("child_without_bed", "child_without_bed_price", "child_without_bed_currency"),
    ("infant", "infant_price", "infant_currency"),
    ("tour_flight", "regular_flight_price", "regular_flight_currency"),
    (
        "child_with_bed_flight",
        "child_with_bed_flight_price",
        "child_with_bed_flight_currency",
    ),
):
    COMBINED_FIELD_SPECS[name] = FieldSpec(
        TourCombinedDeparturePrice,
        getattr(TourCombinedDeparturePrice, price_field),
        getattr(TourCombinedDeparturePrice, currency_field),
    )


FIELD_SPECS["extra_flight"] = FieldSpec(
    TourDepartureHotelPrice,
    TourDepartureHotelPrice.flight_price_per_person,
    TourDepartureHotelPrice.flight_currency,
    preserve_inherited_flights=True,
)
COMBINED_FIELD_SPECS["extra_flight"] = FieldSpec(
    TourCombinedDeparturePrice,
    TourCombinedDeparturePrice.regular_flight_price,
    TourCombinedDeparturePrice.regular_flight_currency,
    preserve_inherited_flights=True,
)


def _update_values(spec: FieldSpec, new_value: ColumnElement[Any]) -> dict[str, Any]:
    values = {spec.price.key: new_value}
    if spec.preserve_inherited_flights:
        # Extra beds use the shared flight. Materialize other occupancies'
        # inherited amounts atomically before changing that shared value.
        model = spec.model
        for occupancy in ("double", "single"):
            column = getattr(model, f"{occupancy}_flight_price")
            values[column.key] = func.coalesce(column, spec.price)
        values["child_with_bed_flight_price"] = func.coalesce(
            model.child_with_bed_flight_price, spec.price
        )
        values["child_with_bed_flight_currency"] = case(
            (model.child_with_bed_flight_price.is_(None), spec.currency),
            else_=model.child_with_bed_flight_currency,
        )
    return values


def _field_specs(payload: BulkPriceV2Request):
    for name in payload.price_fields:
        yield FIELD_SPECS[name]
        if name in COMBINED_FIELD_SPECS:
            yield COMBINED_FIELD_SPECS[name]


def _toman_value(price: InstrumentedAttribute[Any], currency: ColumnElement[Any]):
    return case((currency == "IRR", price / Decimal(10)), else_=price)


def _database_delta(currency: ColumnElement[Any], value: Decimal):
    return case((currency == "IRR", value * Decimal(10)), else_=value)


class BulkPricingV2Repository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def options(self) -> BulkPricingV2Options:
        tours = (
            await self.session.execute(
                select(Tour.id, Tour.title).order_by(Tour.title).limit(500)
            )
        ).all()
        hotels = (
            await self.session.execute(
                select(Hotel.id, Hotel.name, Hotel.city)
                .order_by(Hotel.name)
                .limit(1000)
            )
        ).all()
        cities = list(
            (
                await self.session.scalars(
                    select(distinct(Hotel.city))
                    .where(Hotel.city.is_not(None), Hotel.city != "")
                    .order_by(Hotel.city)
                )
            ).all()
        )
        tickets = (
            await self.session.execute(
                select(
                    TravelService.id, TravelService.title, TravelService.service_type
                )
                .where(TravelService.service_type.in_(("flight", "train", "bus")))
                .order_by(TravelService.title)
                .limit(1000)
            )
        ).all()
        return BulkPricingV2Options(
            tours=[PricingOption(id=item_id, label=label) for item_id, label in tours],
            hotels=[
                PricingOption(id=item_id, label=label, subtitle=city)
                for item_id, label, city in hotels
            ],
            cities=cities,
            tickets=[
                PricingOption(id=item_id, label=label, subtitle=service_type)
                for item_id, label, service_type in tickets
            ],
        )

    async def departures(
        self, tour_id: int, *, limit: int, offset: int
    ) -> list[PricingDepartureOption]:
        rows = (
            await self.session.execute(
                select(
                    TourDeparture.id,
                    TourDeparture.label,
                    TourDeparture.departure_date,
                    TourDeparture.return_date,
                    TourDeparture.nights,
                )
                .where(TourDeparture.tour_id == tour_id)
                .order_by(TourDeparture.display_order, TourDeparture.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return [PricingDepartureOption(**row._mapping) for row in rows]

    def _filters(self, payload: BulkPriceV2Request, spec: FieldSpec):
        if spec.model is TourDeparture:
            return (
                TourDeparture.tour_id.in_(payload.tour_ids),
                TourDeparture.id == payload.departure_id,
            )
        if spec.model in (TourDepartureHotelPrice, TourCombinedDeparturePrice):
            departure_ids = select(TourDeparture.id).where(
                TourDeparture.tour_id.in_(payload.tour_ids),
                TourDeparture.id == payload.departure_id,
            )
            return (spec.model.departure_id.in_(departure_ids),)
        if spec.model is Hotel:
            return (
                (Hotel.id.in_(payload.hotel_ids),)
                if payload.target == "hotels"
                else (Hotel.city == payload.city.strip(),)
            )
        return (TravelService.id.in_(payload.ticket_ids),)

    async def _selected_items(self, payload: BulkPriceV2Request) -> int:
        if payload.target == "tour":
            return len(payload.tour_ids)
        if payload.target == "hotels":
            return len(payload.hotel_ids)
        if payload.target == "ticket":
            return len(payload.ticket_ids)
        return int(
            await self.session.scalar(
                select(func.count())
                .select_from(Hotel)
                .where(Hotel.city == payload.city.strip())
            )
            or 0
        )

    async def preview(self, payload: BulkPriceV2Request) -> BulkPriceV2Preview:
        if payload.target == "tour" and not await self.session.scalar(
            select(TourDeparture.id).where(
                TourDeparture.id == payload.departure_id,
                TourDeparture.tour_id.in_(payload.tour_ids),
            )
        ):
            raise ValueError(
                "تاریخ برگزاری انتخاب‌شده متعلق به این تور نیست یا حذف شده است."
            )
        eligible = unpriced = foreign = blocked = 0
        before = Decimal(0)
        total_eligible = 0
        for spec in _field_specs(payload):
            filters = self._filters(payload, spec)
            candidate_count = int(
                await self.session.scalar(
                    select(func.count()).select_from(spec.model).where(*filters)
                )
                or 0
            )
            priced_filters = (
                *filters,
                spec.effective_price.is_not(None),
                spec.currency.is_not(None),
            )
            priced_count = int(
                await self.session.scalar(
                    select(func.count()).select_from(spec.model).where(*priced_filters)
                )
                or 0
            )
            local_filters = (*priced_filters, spec.currency.in_(LOCAL_CURRENCIES))
            local_count = int(
                await self.session.scalar(
                    select(func.count()).select_from(spec.model).where(*local_filters)
                )
                or 0
            )
            unpriced += candidate_count - priced_count
            if payload.currency == "IRT":
                selected_filters = local_filters
                selected_count = local_count
            elif payload.currency:
                selected_filters = (*priced_filters, spec.currency == payload.currency)
                selected_count = int(
                    await self.session.scalar(
                        select(func.count())
                        .select_from(spec.model)
                        .where(*selected_filters)
                    )
                    or 0
                )
            elif payload.calculation == "fixed":
                selected_filters = local_filters
                selected_count = local_count
            else:
                selected_filters = priced_filters
                selected_count = priced_count
            if payload.currency is not None or payload.calculation == "fixed":
                foreign += priced_count - selected_count
            blocked_for_field = 0
            safe_selected_filters = selected_filters
            if payload.direction == "decrease":
                if payload.calculation == "percentage" and payload.value > 100:
                    blocked_for_field = selected_count
                elif payload.calculation == "fixed":
                    database_delta = _database_delta(spec.currency, payload.value)
                    blocked_for_field = int(
                        await self.session.scalar(
                            select(func.count())
                            .select_from(spec.model)
                            .where(
                                *selected_filters,
                                spec.effective_price < database_delta,
                            )
                        )
                        or 0
                    )
                    safe_selected_filters = (
                        *selected_filters,
                        spec.effective_price >= database_delta,
                    )
            blocked += blocked_for_field
            if (
                payload.direction == "decrease"
                and payload.calculation == "percentage"
                and payload.value > 100
            ):
                eligible_for_field = 0
            else:
                eligible_for_field = selected_count - blocked_for_field
            eligible += eligible_for_field
            if payload.currency is not None or payload.calculation == "fixed":
                total_filters = safe_selected_filters
                total_eligible_for_field = eligible_for_field
            else:
                total_filters = local_filters
                total_eligible_for_field = (
                    0
                    if payload.direction == "decrease"
                    and payload.calculation == "percentage"
                    and payload.value > 100
                    else local_count
                )
            total_eligible += total_eligible_for_field
            if total_eligible_for_field:
                before += Decimal(
                    await self.session.scalar(
                        select(
                            func.coalesce(
                                func.sum(
                                    _toman_value(spec.effective_price, spec.currency)
                                ),
                                0,
                            )
                        )
                        .select_from(spec.model)
                        .where(*total_filters)
                    )
                    or 0
                )
        if payload.calculation == "percentage":
            factor = payload.value / Decimal(100)
            after = before * (
                Decimal(1) + factor
                if payload.direction == "increase"
                else Decimal(1) - factor
            )
        else:
            delta = payload.value * total_eligible
            after = (
                before + delta if payload.direction == "increase" else before - delta
            )
        return BulkPriceV2Preview(
            target=payload.target,
            direction=payload.direction,
            calculation=payload.calculation,
            value=payload.value,
            selected_items=await self._selected_items(payload),
            eligible_rates=eligible,
            skipped_unpriced=unpriced,
            skipped_foreign_currency=foreign,
            blocked_rates=blocked,
            before_total_toman=before,
            after_total_toman=after,
            can_apply=eligible > 0,
        )

    async def apply(self, payload: BulkPriceV2Request, *, admin_id: int):
        preview = await self.preview(payload)
        if not preview.can_apply:
            raise ValueError("no eligible price remains after skipping invalid rates")
        updated = 0
        signed = Decimal(1) if payload.direction == "increase" else Decimal(-1)
        for spec in _field_specs(payload):
            filters = [
                *self._filters(payload, spec),
                spec.effective_price.is_not(None),
                spec.currency.is_not(None),
            ]
            if payload.calculation == "fixed":
                if payload.currency == "IRT" or payload.currency is None:
                    filters.append(spec.currency.in_(LOCAL_CURRENCIES))
                else:
                    filters.append(spec.currency == payload.currency)
                if payload.direction == "decrease":
                    filters.append(
                        spec.effective_price
                        >= _database_delta(spec.currency, payload.value)
                    )
                new_value = spec.effective_price + signed * _database_delta(
                    spec.currency, payload.value
                )
            else:
                if payload.currency == "IRT":
                    filters.append(spec.currency.in_(LOCAL_CURRENCIES))
                elif payload.currency:
                    filters.append(spec.currency == payload.currency)
                new_value = spec.effective_price * (
                    Decimal(1) + signed * payload.value / Decimal(100)
                )
            result = await self.session.execute(
                update(spec.model)
                .where(*filters)
                .values(_update_values(spec, new_value))
            )
            updated += int(result.rowcount or 0)
        if updated != preview.eligible_rates:
            raise RuntimeError("price set changed during bulk adjustment")
        selection = {
            "tourIds": payload.tour_ids,
            "departureId": payload.departure_id,
            "hotelIds": payload.hotel_ids,
            "city": payload.city,
            "ticketIds": payload.ticket_ids,
            "currency": payload.currency,
        }
        audit = BulkPriceAdjustment(
            admin_id=admin_id,
            target=(
                "hotel"
                if payload.target in {"hotels", "city"}
                else "all"
                if payload.target == "ticket"
                else payload.target
            ),
            direction=payload.direction,
            calculation=payload.calculation,
            amount_toman=payload.value,
            selection_snapshot=selection,
            price_fields=list(payload.price_fields),
            affected_rates=updated,
            skipped_unpriced=preview.skipped_unpriced,
            skipped_foreign_currency=preview.skipped_foreign_currency,
            before_total_toman=preview.before_total_toman,
            after_total_toman=preview.after_total_toman,
        )
        self.session.add(audit)
        await self.session.flush()
        return audit, preview
