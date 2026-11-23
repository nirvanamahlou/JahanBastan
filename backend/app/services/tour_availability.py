"""Shared booking gate for an entire tour departure."""

from app.models import TourDeparture


def is_departure_bookable(departure: TourDeparture) -> bool:
    """A hotel's availability cannot override a closed or exhausted departure."""
    return departure.booking_status == "open" and (
        departure.capacity_remaining is None or departure.capacity_remaining > 0
    )
