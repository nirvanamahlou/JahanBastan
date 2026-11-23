"""Atomic price adjustments for selected date-specific tour hotel rooms."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models import (
    AdminUser,
    BulkPriceAdjustment,
    Hotel,
    Tour,
    TourDeparture,
    TourDepartureHotelPrice,
)
from app.schemas.pricing import (
    BulkPriceAdjustmentRequest,
    BulkPricePreview,
    BulkPricingOptions,
    TourPricingOption,
    TourRoomOption,
)

SUPPORTED_CURRENCIES = ("IRT", "IRR")


@dataclass(frozen=True)
class PriceField:
    price: InstrumentedAttribute[Any]
    currency: ColumnElement[Any]


ROOM_PRICE_FIELDS = (
    PriceField(
        TourDepartureHotelPrice.double_price,
        func.coalesce(
            TourDepartureHotelPrice.double_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    PriceField(
        TourDepartureHotelPrice.single_price,
        func.coalesce(
            TourDepartureHotelPrice.single_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    PriceField(
        TourDepartureHotelPrice.child_with_bed_price,
        func.coalesce(
            TourDepartureHotelPrice.child_with_bed_currency,
            TourDepartureHotelPrice.package_currency,
        ),
    ),
    PriceField(
        TourDepartureHotelPrice.child_without_bed_price,
        TourDepartureHotelPrice.child_without_bed_currency,
    ),
)


def database_delta(currency: ColumnElement[Any], amount_toman: Decimal):
    return case((currency == "IRR", amount_toman * Decimal(10)), else_=amount_toman)


def toman_value(price: InstrumentedAttribute[Any], currency: ColumnElement[Any]):
    return case((currency == "IRR", price / Decimal(10)), else_=price)


class BulkPricingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def options(self) -> BulkPricingOptions:
        rows = (
            await self.session.execute(
                select(
                    Tour.id,
                    Tour.title,
                    TourDepartureHotelPrice.id,
                    Hotel.name,
                    TourDepartureHotelPrice.room_type,
                    TourDeparture.label,
                    TourDeparture.nights,
                    func.coalesce(
                        TourDepartureHotelPrice.double_currency,
                        TourDepartureHotelPrice.package_currency,
                    ),
                    TourDepartureHotelPrice.double_price,
                    TourDepartureHotelPrice.single_price,
                    TourDepartureHotelPrice.child_with_bed_price,
                    TourDepartureHotelPrice.child_without_bed_price,
                )
                .join(
                    TourDeparture,
                    TourDeparture.id == TourDepartureHotelPrice.departure_id,
                )
                .join(Tour, Tour.id == TourDeparture.tour_id)
                .join(Hotel, Hotel.id == TourDepartureHotelPrice.hotel_id)
                .order_by(
                    Tour.title,
                    Tour.id,
                    TourDeparture.display_order,
                    TourDepartureHotelPrice.display_order,
                )
            )
        ).all()

        grouped: dict[int, TourPricingOption] = {}
        for row in rows:
            (
                tour_id,
                title,
                room_id,
                hotel_name,
                room_type,
                departure_label,
                nights,
                currency,
                *prices,
            ) = row
            grouped.setdefault(
                tour_id,
                TourPricingOption(id=tour_id, title=title, rooms=[]),
            )
            grouped[tour_id].rooms.append(
                TourRoomOption(
                    id=room_id,
                    tour_id=tour_id,
                    tour_title=title,
                    hotel_name=hotel_name,
                    room_label=f"{room_type} — {departure_label}",
                    city=None,
                    nights=nights or 0,
                    currency=currency,
                    priced_rates=sum(price is not None for price in prices),
                )
            )
        return BulkPricingOptions(tours=list(grouped.values()))

    def _filters(self, payload: BulkPriceAdjustmentRequest):
        departure_ids = select(TourDeparture.id).where(
            TourDeparture.tour_id.in_(payload.tour_ids)
        )
        return (
            TourDepartureHotelPrice.id.in_(payload.room_ids),
            TourDepartureHotelPrice.departure_id.in_(departure_ids),
        )

    async def _validate(self, payload: BulkPriceAdjustmentRequest) -> None:
        count = await self.session.scalar(
            select(func.count())
            .select_from(TourDepartureHotelPrice)
            .where(*self._filters(payload))
        )
        if int(count or 0) != len(payload.room_ids):
            raise ValueError(
                "one or more selected prices do not belong to selected tours"
            )

    async def preview(self, payload: BulkPriceAdjustmentRequest) -> BulkPricePreview:
        await self._validate(payload)
        base = self._filters(payload)
        eligible = unpriced = foreign = blocked = 0
        before = Decimal(0)

        for item in ROOM_PRICE_FIELDS:
            priced = (*base, item.price.is_not(None))
            priced_count = int(
                await self.session.scalar(
                    select(func.count())
                    .select_from(TourDepartureHotelPrice)
                    .where(*priced)
                )
                or 0
            )
            eligible_filter = (*priced, item.currency.in_(SUPPORTED_CURRENCIES))
            eligible_count = int(
                await self.session.scalar(
                    select(func.count())
                    .select_from(TourDepartureHotelPrice)
                    .where(*eligible_filter)
                )
                or 0
            )
            eligible += eligible_count
            unpriced += len(payload.room_ids) - priced_count
            foreign += priced_count - eligible_count
            before += Decimal(
                await self.session.scalar(
                    select(
                        func.coalesce(
                            func.sum(toman_value(item.price, item.currency)),
                            0,
                        )
                    )
                    .select_from(TourDepartureHotelPrice)
                    .where(*eligible_filter)
                )
                or 0
            )
            if payload.direction == "decrease":
                blocked += int(
                    await self.session.scalar(
                        select(func.count())
                        .select_from(TourDepartureHotelPrice)
                        .where(
                            *eligible_filter,
                            item.price
                            <= database_delta(item.currency, payload.amount_toman),
                        )
                    )
                    or 0
                )

        delta = payload.amount_toman * eligible
        return BulkPricePreview(
            target="tour",
            direction=payload.direction,
            amount_toman=payload.amount_toman,
            selected_tours=len(payload.tour_ids),
            selected_rooms=len(payload.room_ids),
            eligible_rates=eligible,
            skipped_unpriced=unpriced,
            skipped_foreign_currency=foreign,
            blocked_rates=blocked,
            before_total_toman=before,
            after_total_toman=before + delta
            if payload.direction == "increase"
            else before - delta,
            can_apply=eligible > 0 and blocked == 0,
        )

    async def apply(
        self,
        payload: BulkPriceAdjustmentRequest,
        *,
        admin_id: int,
    ):
        preview = await self.preview(payload)
        if not preview.eligible_rates:
            raise ValueError("no eligible rates for this selection")
        if preview.blocked_rates:
            raise ValueError("decrease would make one or more rates zero or negative")

        signed = Decimal(1) if payload.direction == "increase" else Decimal(-1)
        updated = 0
        for item in ROOM_PRICE_FIELDS:
            result = await self.session.execute(
                update(TourDepartureHotelPrice)
                .where(
                    *self._filters(payload),
                    item.price.is_not(None),
                    item.currency.in_(SUPPORTED_CURRENCIES),
                )
                .values(
                    {
                        item.price.key: item.price
                        + signed * database_delta(item.currency, payload.amount_toman)
                    }
                )
            )
            updated += int(result.rowcount or 0)
        if updated != preview.eligible_rates:
            raise RuntimeError("price set changed during bulk adjustment")

        audit = BulkPriceAdjustment(
            admin_id=admin_id,
            target="tour",
            direction=payload.direction,
            amount_toman=payload.amount_toman,
            affected_rates=updated,
            skipped_unpriced=preview.skipped_unpriced,
            skipped_foreign_currency=preview.skipped_foreign_currency,
            before_total_toman=preview.before_total_toman,
            after_total_toman=preview.after_total_toman,
        )
        self.session.add(audit)
        await self.session.flush()
        return audit, preview

    async def history(self, *, limit: int = 30):
        rows = await self.session.execute(
            select(
                BulkPriceAdjustment, func.coalesce(AdminUser.full_name, "کاربر حذف‌شده")
            )
            .outerjoin(AdminUser, AdminUser.id == BulkPriceAdjustment.admin_id)
            .where(BulkPriceAdjustment.target == "tour")
            .order_by(
                BulkPriceAdjustment.created_at.desc(),
                BulkPriceAdjustment.id.desc(),
            )
            .limit(limit)
        )
        return list(rows.all())
