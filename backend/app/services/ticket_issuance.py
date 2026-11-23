"""Idempotent passenger-ticket issuance after a verified settlement."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    BookingPassengerTicket,
    BookingRequest,
    Tour,
    TravelService,
)


def _ticket_number(booking_id: int, item_id: int, passenger_index: int) -> str:
    """Derive a stable number, so request retries cannot create a new ticket."""
    return f"JBT-{booking_id:08d}-{item_id:08d}-{passenger_index + 1:02d}"


def _passenger_value(passenger: dict[str, Any], field: str) -> Any:
    """Read both persisted snake_case snapshots and legacy camelCase data."""
    value = passenger.get(field)
    if value is None:
        value = passenger.get(
            "".join(
                [field.split("_")[0], *[part.title() for part in field.split("_")[1:]]]
            )
        )
    return value


def _passenger_name(passenger: dict[str, Any]) -> tuple[str, str]:
    first_name = str(_passenger_value(passenger, "first_name") or "").strip()
    last_name = str(_passenger_value(passenger, "last_name") or "").strip()
    if not first_name or not last_name:
        full_name = str(_passenger_value(passenger, "full_name") or "").strip()
        parts = full_name.split()
        if len(parts) >= 2:
            first_name = first_name or parts[0]
            last_name = last_name or " ".join(parts[1:])
    return first_name, last_name


def _route(origin: str | None, destination: str | None, fallback: str) -> str:
    start = (origin or "").strip()
    end = (destination or "").strip()
    return f"{start} → {end}" if start and end else fallback


async def _travel_details(session: AsyncSession, item) -> dict[str, Any]:
    details: dict[str, Any] = {
        "item_type": item.item_type,
        "service_title": item.title_snapshot,
        "route": item.title_snapshot,
        "departure_airport": None,
        "arrival_airport": None,
        "departure_date": None,
        "departure_time": None,
        "carrier": None,
        "travel_class": None,
        "baggage_allowance": None,
    }
    if item.travel_service_id is not None:
        service = await session.get(TravelService, item.travel_service_id)
        if service is not None:
            details.update(
                {
                    "service_title": service.title,
                    "route": _route(
                        service.origin, service.destination_name, item.title_snapshot
                    ),
                    "departure_airport": service.origin_airport,
                    "arrival_airport": service.destination_airport,
                    "departure_date": service.departure_date,
                    "departure_time": service.departure_time,
                    "carrier": service.provider_company,
                    "travel_class": service.transport_class or service.flight_class,
                    "baggage_allowance": service.baggage_allowance,
                }
            )
        return details
    if item.tour_id is not None:
        tour = await session.get(Tour, item.tour_id)
        if tour is not None:
            details.update(
                {
                    "service_title": tour.title,
                    "route": _route(
                        tour.origin or tour.origin_airport,
                        tour.destination_airport,
                        item.title_snapshot,
                    ),
                    "departure_airport": tour.origin_airport,
                    "arrival_airport": tour.destination_airport,
                    "departure_date": tour.departure_date,
                    "departure_time": tour.departure_time,
                    "carrier": tour.airline_name or tour.transportation,
                }
            )
    return details


async def issue_booking_tickets(
    session: AsyncSession, booking_id: int
) -> list[BookingPassengerTicket]:
    """Create only missing ticket rows for a paid booking while holding its lock."""
    booking = await session.scalar(
        select(BookingRequest)
        .options(selectinload(BookingRequest.items))
        .where(BookingRequest.id == booking_id)
        .with_for_update()
    )
    if booking is None:
        return []
    if booking.status != "paid":
        raise ValueError("tickets can only be issued for paid bookings")
    passengers = list(booking.passenger_details or [])
    if not passengers:
        return []
    existing = list(
        await session.scalars(
            select(BookingPassengerTicket).where(
                BookingPassengerTicket.booking_id == booking.id
            )
        )
    )
    existing_keys = {
        (ticket.booking_item_id, ticket.passenger_index) for ticket in existing
    }
    for item in booking.items:
        travel = await _travel_details(session, item)
        for passenger_index, passenger in enumerate(passengers):
            key = (item.id, passenger_index)
            if key in existing_keys:
                continue
            first_name, last_name = _passenger_name(passenger)
            if not first_name or not last_name:
                raise ValueError("passenger name is incomplete")
            session.add(
                BookingPassengerTicket(
                    booking_id=booking.id,
                    booking_item_id=item.id,
                    passenger_index=passenger_index,
                    ticket_number=_ticket_number(booking.id, item.id, passenger_index),
                    passenger_type=str(
                        _passenger_value(passenger, "passenger_type") or "adult"
                    ),
                    first_name=first_name,
                    last_name=last_name,
                    father_name=_passenger_value(passenger, "father_name"),
                    first_name_en=_passenger_value(passenger, "first_name_en"),
                    last_name_en=_passenger_value(passenger, "last_name_en"),
                    national_code=_passenger_value(passenger, "national_code"),
                    passport_number=_passenger_value(passenger, "passport_number"),
                    **travel,
                )
            )
    await session.flush()
    return list(
        await session.scalars(
            select(BookingPassengerTicket)
            .where(BookingPassengerTicket.booking_id == booking.id)
            .order_by(BookingPassengerTicket.id)
        )
    )
