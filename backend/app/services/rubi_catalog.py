"""Validate signed Rubi deliveries and project passenger-visible adult flight rates."""

import hashlib
import hmac
import re
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class Catalog(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True)
    site: Literal["jahan-bastan"]
    version: Literal[1]
    revision: int = Field(gt=0, le=9007199254740991)
    data: list[dict[str, Any]]


class Receipt(BaseModel):
    accepted: bool
    revision: int


class FlightAirport(BaseModel):
    name: str | None = None
    code: str | None = None


class FlightLeg(BaseModel):
    id: str
    product_id: str
    offer_id: str
    origin_id: str
    destination_id: str
    origin: str
    destination: str
    carrier: str
    carrier_logo_sha256: str | None = None
    origin_airport: FlightAirport | None = None
    destination_airport: FlightAirport | None = None
    remaining_capacity: int | None = None
    baggage_kg: str | None = None
    departure: datetime
    arrival: datetime
    departure_snapshot: str | None = Field(default=None, exclude=True, repr=False)
    arrival_snapshot: str | None = Field(default=None, exclude=True, repr=False)
    service_number: str | None = None
    cabin_class_code: str = "ECONOMY"

    @staticmethod
    def _catalog_timestamp(value: datetime, snapshot: str | None) -> str:
        if snapshot:
            return snapshot
        return (
            value.astimezone(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    @field_serializer("departure", when_used="json")
    def serialize_departure(self, value: datetime) -> str:
        return self._catalog_timestamp(value, self.departure_snapshot)

    @field_serializer("arrival", when_used="json")
    def serialize_arrival(self, value: datetime) -> str:
        return self._catalog_timestamp(value, self.arrival_snapshot)


class PublicFlight(FlightLeg):
    return_leg: FlightLeg | None = None
    product_ids: list[str]
    amount: str
    currency: str


def valid_signature(
    body: bytes, stamp: str, signature: str, key: str, now: int
) -> bool:
    if len(key) < 32 or not re.fullmatch(r"[0-9]{10}", stamp):
        return False
    if abs(now - int(stamp)) > 300 or not re.fullmatch(r"[0-9a-f]{64}", signature):
        return False
    digest = hmac.new(key.encode(), stamp.encode() + b"." + body, hashlib.sha256)
    return hmac.compare_digest(digest.hexdigest(), signature)


def _fare_amount(fare: dict, consumed: int) -> str | None:
    amount = fare["amount"]
    if fare.get("tiers"):
        for tier in fare["tiers"]:
            consumed -= tier["seatCount"]
            if consumed < 0:
                amount = tier["amount"]
                break
        else:
            return None
    price = Decimal(amount)
    return str(price) if price.is_finite() and price >= 0 else None


def _routes(flight: dict) -> set[tuple[str, str]]:
    return {
        (r["originId"], r["destinationId"])
        for r in [flight, *(flight.get("saleRoutes") or [])]
        if r.get("originId") and r.get("destinationId")
    }


def catalog_logo_png(asset: dict[str, Any], sha256: str) -> bytes | None:
    encoded = asset.get("dataBase64")
    if asset.get("mimeType") != "image/png" or not isinstance(encoded, str):
        return None
    if len(encoded) > ((256 * 1024 + 2) // 3) * 4:
        return None
    try:
        data = b64decode(encoded, validate=True)
    except (ValueError, Base64Error):
        return None
    if (
        len(data) > 256 * 1024
        or not data.startswith(b"\x89PNG\r\n\x1a\n")
        or hashlib.sha256(data).hexdigest() != sha256
    ):
        return None
    return data


def _public_airport(value: Any) -> FlightAirport | None:
    if not isinstance(value, dict):
        return None
    name = value.get("name")
    code = value.get("iataCode")
    name = name.strip()[:160] if isinstance(name, str) else None
    code = code.strip().upper() if isinstance(code, str) else None
    code = code if code and re.fullmatch(r"[A-Z]{3}", code) else None
    return FlightAirport(name=name or None, code=code) if name or code else None


def public_flights(
    items: list[dict[str, Any]],
    now: datetime,
    logo_hashes: frozenset[str] = frozenset(),
) -> list[PublicFlight]:
    legs = {}
    for row in items:
        if (
            row.get("kind") != "ticket"
            or row.get("enabled") is not True
            or row.get("salesStopped")
        ):
            continue
        flight = row.get("flight") or {}
        try:
            departure = datetime.fromisoformat(flight["departureAt"])
            if (
                flight["status"] != "ACTIVE"
                or flight["remainingCapacity"] <= 0
                or departure <= now
            ):
                continue
            logo_url = flight.get("carrierLogoUrl")
            logo = re.fullmatch(
                r"https://jahanbastan\.ir/api/v1/erp/airline-logos/([0-9a-f]{64})",
                logo_url if isinstance(logo_url, str) else "",
            )
            cabin = flight.get("cabinClassCode") or "ECONOMY"
            baggage_field = {
                "ECONOMY": "economyBaggageKg",
                "BUSINESS": "businessBaggageKg",
            }.get(cabin)
            baggage = flight.get(baggage_field) if baggage_field else None
            leg = FlightLeg(
                id=row["id"],
                product_id=row["id"],
                offer_id=flight.get("id") or row.get("resourceId") or row["id"],
                origin_id=flight.get("originId") or flight["originName"],
                destination_id=flight.get("destinationId") or flight["destinationName"],
                origin=flight["originName"],
                destination=flight["destinationName"],
                carrier=flight["carrierName"],
                origin_airport=_public_airport(flight.get("originAirport")),
                destination_airport=_public_airport(flight.get("destinationAirport")),
                remaining_capacity=flight["remainingCapacity"],
                baggage_kg=(
                    baggage
                    if isinstance(baggage, str)
                    and re.fullmatch(r"[0-9]{1,3}(?:\.[0-9]{1,2})?", baggage)
                    else None
                ),
                carrier_logo_sha256=(
                    logo[1] if logo and logo[1] in logo_hashes else None
                ),
                departure=departure,
                departure_snapshot=flight["departureAt"],
                arrival=datetime.fromisoformat(
                    flight.get("arrivalAt") or flight["departureAt"]
                ),
                arrival_snapshot=flight.get("arrivalAt") or flight["departureAt"],
                service_number=flight.get("serviceNumber"),
                cabin_class_code=cabin,
            )
            consumed = flight.get("allocatedCapacity", 0) + flight.get(
                "reservedCapacity", 0
            )
            legs[flight.get("id") or row.get("resourceId") or row["id"]] = (
                leg,
                flight,
                consumed,
            )
        except (ValueError, KeyError, TypeError):
            continue

    flights = []
    tehran = timezone(timedelta(hours=3, minutes=30))
    for leg, flight, consumed in legs.values():
        fares = [(flight.get("standaloneSalePrice"), False)]
        fares.extend((fare, True) for fare in flight.get("roundTripSalePrices") or [])
        for fare, paired in fares:
            if not isinstance(fare, dict):
                continue
            try:
                returning = None
                used = consumed
                if paired:
                    returning, reverse, reverse_used = legs[fare["returnOfferId"]]
                    days = (
                        returning.departure.astimezone(tehran).date()
                        - leg.departure.astimezone(tehran).date()
                    ).days
                    if (
                        returning.departure <= leg.departure
                        or returning.departure
                        < datetime.fromisoformat(flight["arrivalAt"])
                        or not any(
                            (b, a) in _routes(reverse) for a, b in _routes(flight)
                        )
                        or days < (flight.get("returnMinDays") or 0)
                        or (
                            flight.get("returnMaxDays") is not None
                            and days > flight["returnMaxDays"]
                        )
                    ):
                        continue
                    used = max(used, reverse_used)
                amount = _fare_amount(fare, used)
                if amount is not None:
                    product_ids = [leg.product_id]
                    if returning:
                        product_ids.append(returning.product_id)
                    flights.append(
                        PublicFlight(
                            **leg.model_dump(),
                            return_leg=returning,
                            product_ids=product_ids,
                            amount=amount,
                            currency=fare["currencyCode"],
                        )
                    )
            except (ValueError, KeyError, TypeError, InvalidOperation):
                continue
    return sorted(flights, key=lambda item: (item.departure, item.product_ids))


def filter_public_flights(
    flights: list[PublicFlight],
    *,
    origin: str | None = None,
    destination: str | None = None,
    departure_date: date | None = None,
    return_date: date | None = None,
    trip_type: Literal["one_way", "round_trip"] | None = None,
) -> list[PublicFlight]:
    """Apply site-search filters using Tehran calendar dates."""
    tehran = timezone(timedelta(hours=3, minutes=30))
    normalized_origin = origin.strip().casefold() if origin else None
    normalized_destination = destination.strip().casefold() if destination else None
    result: list[PublicFlight] = []
    for flight in flights:
        if normalized_origin and flight.origin.strip().casefold() != normalized_origin:
            continue
        if (
            normalized_destination
            and flight.destination.strip().casefold() != normalized_destination
        ):
            continue
        if (
            departure_date
            and flight.departure.astimezone(tehran).date() != departure_date
        ):
            continue
        if trip_type == "one_way" and flight.return_leg is not None:
            continue
        if trip_type == "round_trip" and flight.return_leg is None:
            continue
        if (
            trip_type == "round_trip"
            and return_date
            and flight.return_leg
            and flight.return_leg.departure.astimezone(tehran).date() != return_date
        ):
            continue
        result.append(flight)
    return result


class CatalogPrice(BaseModel):
    amount: str
    currencyCode: str


class CatalogPassengerRate(BaseModel):
    hotelId: str
    kind: str
    roomTypeName: str | None = None
    checkIn: date | None = None
    checkOut: date | None = None
    hotel: list[CatalogPrice]
    flight: list[CatalogPrice]
    total: list[CatalogPrice]


class CatalogName(BaseModel):
    name: str


class CatalogCity(BaseModel):
    name: str
    country: CatalogName


class CatalogFacility(BaseModel):
    facility: CatalogName


class CatalogHotel(BaseModel):
    id: str
    identificationCode: str | None = None
    name: str
    description: str | None = None
    address: str | None = None
    starRating: int | None = None
    englishName: str | None = None
    serviceLevel: str | None = None
    city: CatalogCity | None = None
    facilities: list[CatalogFacility] = Field(default_factory=list)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    sourceMainImage: str | None = None
    sourceGalleryImages: str | None = None
    hotelRules: str | None = None
    sourceRefundRules: str | None = None


class CatalogTourFlight(BaseModel):
    originName: str
    destinationName: str
    departureAt: datetime
    arrivalAt: datetime | None = None
    carrierName: str
    serviceNumber: str


class TourItineraryStep(BaseModel):
    title: str | None = None
    location: str | None = None
    description: str | None = None
    startTime: str | None = None
    stayDays: int | None = None


class TourProfileDetails(BaseModel):
    summary: str | None = None
    description: str | None = None
    services: str | None = None
    requiredDocuments: str | None = None
    refundRules: str | None = None
    installmentTerms: str | None = None
    itinerary: list[TourItineraryStep] = Field(default_factory=list)


class PublicTourHotel(CatalogHotel):
    profileSlug: str | None = None


class PublicDatedTour(BaseModel):
    resourceId: str
    kind: Literal["tour", "floating-tour"] = "tour"
    details: TourProfileDetails = Field(default_factory=TourProfileDetails)
    includedServices: list[str] = Field(default_factory=list)
    id: str
    title: str
    description: str | None = None
    startsOn: date
    endsOn: date
    remainingCapacity: int | None
    outbound: CatalogTourFlight
    returning: CatalogTourFlight | None = None
    hotels: list[PublicTourHotel]
    rates: list[CatalogPassengerRate]
    previewOnly: bool
    salesStopped: bool
