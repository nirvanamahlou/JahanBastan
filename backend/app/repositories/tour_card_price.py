"""Refresh the hotel-only starting price after an Excel import."""

from decimal import Decimal

from sqlalchemy import func, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ExchangeRate,
    Hotel,
    Tour,
    TourCombinedDeparturePrice,
    TourCombinedPackage,
    TourDeparture,
    TourDepartureHotelPrice,
)


def lowest_hotel_price(
    candidates: list[tuple[Decimal, str]], rates: dict[str, Decimal]
) -> tuple[Decimal, str] | None:
    """Compare currencies in toman but retain the selected offer's currency."""
    candidates = [(amount, currency) for amount, currency in candidates if amount > 0]
    if not candidates:
        return None
    if len({currency for _, currency in candidates}) == 1:
        return min(candidates, key=lambda item: item[0])
    conversion = {**rates, "IRT": Decimal(1), "IRR": Decimal("0.1")}
    if any(conversion.get(currency, 0) <= 0 for _, currency in candidates):
        return None
    return min(candidates, key=lambda item: item[0] * conversion[item[1]])


async def refresh_tour_card_price(
    session: AsyncSession, tour: Tour, *, combined: bool | None = None
) -> None:
    """Use all retained dates, excluding retired offers and wrong-city hotels."""
    await session.flush()
    if combined if combined is not None else tour.is_combined_stay:
        price = TourCombinedDeparturePrice
        statement = (
            select(price.departure_id, price.double_price, price.double_currency)
            .join(TourCombinedPackage, TourCombinedPackage.id == price.package_id)
            .where(TourCombinedPackage.tour_id == tour.id, price.double_price > 0)
        )
    else:
        price = TourDepartureHotelPrice
        statement = (
            select(
                price.departure_id,
                price.double_price,
                func.coalesce(price.double_currency, price.package_currency),
            )
            .join(TourDeparture, TourDeparture.id == price.departure_id)
            .join(Hotel, Hotel.id == price.hotel_id)
            .where(
                TourDeparture.tour_id == tour.id,
                price.is_available.is_(True),
                price.double_price > 0,
            )
        )
        if tour.destination_id is not None:
            statement = statement.where(Hotel.destination_id == tour.destination_id)
    grouped: dict[int, list[tuple[Decimal, str]]] = {}
    for departure_id, amount, currency in await session.execute(statement):
        grouped.setdefault(departure_id, []).append((amount, currency))
    candidates = [item for prices in grouped.values() for item in prices]
    rates = {}
    if len({currency for _, currency in candidates}) > 1:
        rates = dict(
            (
                await session.execute(
                    select(ExchangeRate.currency_code, ExchangeRate.rate_toman)
                )
            ).all()
        )
    minimum = lowest_hotel_price(candidates, rates)
    tour.price_amount = minimum[0] if minimum else None
    if minimum:
        tour.currency = minimum[1]
    departures = await session.scalars(
        select(TourDeparture).where(TourDeparture.tour_id == tour.id)
    )
    for departure in departures:
        minimum = lowest_hotel_price(grouped.get(departure.id, []), rates)
        departure.price_amount = minimum[0] if minimum else None
        if minimum:
            departure.currency = minimum[1]


async def public_hotel_minimums(
    session: AsyncSession, tour_ids: list[int]
) -> tuple[
    dict[int, tuple[Decimal, str] | None], dict[int, tuple[Decimal, str] | None]
]:
    """Read live minimums in a fixed number of queries without changing tour data."""
    if not tour_ids:
        return {}, {}
    p = TourDepartureHotelPrice
    ordinary = (
        select(
            Tour.id,
            p.departure_id,
            p.double_price,
            func.coalesce(p.double_currency, p.package_currency),
        )
        .join(TourDeparture, TourDeparture.tour_id == Tour.id)
        .join(p, p.departure_id == TourDeparture.id)
        .join(Hotel, Hotel.id == p.hotel_id)
        .where(
            Tour.id.in_(tour_ids),
            Tour.is_combined_stay.is_(False),
            p.is_available.is_(True),
            p.double_price > 0,
            or_(
                Tour.destination_id.is_(None),
                Hotel.destination_id == Tour.destination_id,
            ),
        )
    )
    c = TourCombinedDeparturePrice
    combined = (
        select(
            TourCombinedPackage.tour_id,
            c.departure_id,
            c.double_price,
            c.double_currency,
        )
        .join(c, c.package_id == TourCombinedPackage.id)
        .where(TourCombinedPackage.tour_id.in_(tour_ids), c.double_price > 0)
    )
    by_tour: dict[int, list[tuple[Decimal, str]]] = {}
    by_date: dict[int, list[tuple[Decimal, str]]] = {}
    for tour_id, departure_id, amount, currency in await session.execute(
        union_all(ordinary, combined)
    ):
        by_tour.setdefault(tour_id, []).append((amount, currency))
        by_date.setdefault(departure_id, []).append((amount, currency))
    rates = dict(
        (
            await session.execute(
                select(ExchangeRate.currency_code, ExchangeRate.rate_toman)
            )
        ).all()
    )
    return (
        {key: lowest_hotel_price(by_tour.get(key, []), rates) for key in tour_ids},
        {key: lowest_hotel_price(values, rates) for key, values in by_date.items()},
    )
