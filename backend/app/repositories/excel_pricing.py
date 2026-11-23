"""Bounded queries for updating imported tour prices without replacing identities."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TourDepartureHotelPrice


async def load_departure_prices_for_import(
    session: AsyncSession, departure_ids: list[int]
) -> list[TourDepartureHotelPrice]:
    return list(
        await session.scalars(
            select(TourDepartureHotelPrice)
            .where(TourDepartureHotelPrice.departure_id.in_(departure_ids))
            .with_for_update()
        )
    )
