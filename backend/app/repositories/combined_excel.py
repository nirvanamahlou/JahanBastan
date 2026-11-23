"""Bounded, locked queries for combined Excel imports."""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Hotel,
    Tour,
    TourCombinedDeparturePrice,
    TourCombinedPackage,
    TourCombinedPackageHotel,
    TourDeparture,
)


async def uses_combined_prices(session: AsyncSession, tour_id: int) -> bool:
    return (
        await session.scalar(
            select(
                or_(
                    Tour.is_combined_stay,
                    select(TourCombinedPackage.id)
                    .where(TourCombinedPackage.tour_id == Tour.id)
                    .exists(),
                )
            ).where(Tour.id == tour_id)
        )
        is True
    )


async def load_combined_import_context(
    session: AsyncSession, tour_id: int, *, lock: bool = True
) -> tuple[Tour | None, list[TourCombinedPackage], list[TourDeparture]]:
    query = select(Tour).where(Tour.id == tour_id)
    tour = await session.scalar(query.with_for_update() if lock else query)
    if tour is None:
        return None, [], []
    package_query = (
        select(TourCombinedPackage)
        .where(TourCombinedPackage.tour_id == tour_id)
        .options(
            selectinload(TourCombinedPackage.hotels).joinedload(
                TourCombinedPackageHotel.hotel
            )
        )
        .order_by(TourCombinedPackage.display_order)
    )
    packages = list(
        await session.scalars(
            package_query.with_for_update() if lock else package_query
        )
    )
    departure_query = (
        select(TourDeparture)
        .where(TourDeparture.tour_id == tour_id)
        .order_by(TourDeparture.display_order)
    )
    departures = list(
        await session.scalars(
            departure_query.with_for_update() if lock else departure_query
        )
    )
    return tour, packages, departures


async def load_combined_prices(
    session: AsyncSession, package_ids: list[int], departure_ids: list[int]
) -> list[TourCombinedDeparturePrice]:
    return list(
        await session.scalars(
            select(TourCombinedDeparturePrice)
            .where(
                TourCombinedDeparturePrice.package_id.in_(package_ids),
                TourCombinedDeparturePrice.departure_id.in_(departure_ids),
            )
            .with_for_update()
        )
    )


async def load_import_hotels(session: AsyncSession) -> list[Hotel]:
    """Read the catalogue in bounded pages, never one query per workbook row."""
    hotels = []
    offset = 0
    while True:
        page = list(
            await session.scalars(
                select(Hotel).order_by(Hotel.id).offset(offset).limit(500)
            )
        )
        hotels.extend(page)
        if len(page) < 500:
            return hotels
        offset += 500
