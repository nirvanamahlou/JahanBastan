"""Admin article, FAQ, and site-settings contracts."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BeforeValidator, Field, model_validator

from app.core.tour_stage_types import normalize_tour_stage_type
from app.models import PublicationStatus
from app.schemas.catalog import CatalogSchema


def _normalize_airport_code(value: str) -> str:
    return value.strip().upper()


AirportCode = Annotated[
    str,
    BeforeValidator(_normalize_airport_code),
    Field(pattern=r"^[A-Z]{3}$"),
]


def _normalize_visa_form_url(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("visa_form_url must be a string")
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.startswith("/") and not normalized.startswith("//"):
        return normalized
    parsed = urlparse(normalized)
    if parsed.scheme == "https" and parsed.netloc:
        return normalized
    raise ValueError("visa_form_url must be a site-relative or HTTPS URL")


VisaFormUrl = Annotated[
    Annotated[str, Field(max_length=500)] | None,
    BeforeValidator(_normalize_visa_form_url),
]

TourStageType = Annotated[
    str | None,
    BeforeValidator(normalize_tour_stage_type),
    Field(max_length=80),
]


class TourItineraryDayWrite(CatalogSchema):
    day_number: int = Field(ge=1, le=365)
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(min_length=1)


class TourTravelLegWrite(CatalogSchema):
    destination_id: int | None = Field(default=None, ge=1)
    hotel_id: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    stage_type: TourStageType = None
    duration_minutes: int | None = Field(default=None, ge=0, le=32767)
    travel_class: str | None = Field(default=None, max_length=80)
    baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    transportation: str | None = Field(default=None, min_length=2, max_length=50)
    departure_date: date | None = None
    arrival_date: date | None = None
    departure_time: time | None = None
    arrival_time: time | None = None
    airline_name: str | None = Field(default=None, max_length=120)
    flight_number: str | None = Field(default=None, max_length=32)
    stay_nights: int | None = Field(default=None, ge=1, le=365)
    origin: str | None = Field(default=None, min_length=2, max_length=120)
    origin_terminal: str | None = Field(default=None, max_length=160)
    destination: str | None = Field(default=None, min_length=2, max_length=120)
    destination_terminal: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def validate_dates(self) -> "TourTravelLegWrite":
        if (
            self.arrival_date
            and self.departure_date
            and self.arrival_date < self.departure_date
        ):
            raise ValueError("arrival_date cannot be before departure_date")
        return self


class TourDepartureHotelPriceWrite(CatalogSchema):
    id: int | None = Field(default=None, ge=1)
    hotel_id: int = Field(ge=1)
    room_type: str = Field(min_length=1, max_length=80)
    service_type: str = Field(min_length=1, max_length=80)
    external_price_code: str | None = Field(default=None, max_length=64)
    price_set_code: str | None = Field(default=None, max_length=64)
    double_price: Decimal = Field(ge=0)
    single_price: Decimal = Field(ge=0)
    child_with_bed_price: Decimal = Field(ge=0)
    package_currency: str = Field(pattern=r"^[A-Z]{3}$")
    double_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    single_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    child_with_bed_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    extra_price: Decimal | None = Field(default=None, ge=0)
    extra_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    child_without_bed_price: Decimal = Field(ge=0)
    child_without_bed_currency: str = Field(pattern=r"^[A-Z]{3}$")
    infant_price: Decimal = Field(ge=0)
    infant_currency: str = Field(pattern=r"^[A-Z]{3}$")
    double_flight_price: Decimal | None = Field(default=None, ge=0)
    single_flight_price: Decimal | None = Field(default=None, ge=0)
    flight_price_per_person: Decimal = Field(ge=0)
    flight_currency: str = Field(pattern=r"^[A-Z]{3}$")
    child_with_bed_flight_price: Decimal | None = Field(default=None, ge=0)
    child_with_bed_flight_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    is_available: bool = True
    is_base_package: bool = False
    capacity_total: int | None = Field(default=None, ge=0, le=32767)


class TourDepartureWrite(CatalogSchema):
    id: int | None = Field(default=None, ge=1)
    label: str = Field(min_length=2, max_length=160)
    external_code: str | None = Field(default=None, max_length=64)
    price_set_code: str | None = Field(default=None, max_length=64)
    departure_date: date | None = None
    return_date: date | None = None
    capacity_total: int | None = Field(default=None, ge=0, le=32767)
    booking_status: Literal["open", "closed", "sold_out"] = "open"
    outbound_flight_number: str | None = Field(default=None, max_length=32)
    outbound_airline_name: str | None = Field(default=None, max_length=120)
    outbound_airline_logo_image_id: int | None = Field(default=None, ge=1)
    outbound_origin_airport: str | None = Field(default=None, max_length=160)
    outbound_origin_airport_code: AirportCode | None = None
    outbound_destination_airport: str | None = Field(default=None, max_length=160)
    outbound_destination_airport_code: AirportCode | None = None
    outbound_departure_time: time | None = None
    outbound_arrival_time: time | None = None
    outbound_baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    outbound_aircraft_name: str | None = Field(default=None, max_length=120)
    outbound_travel_class: str | None = Field(default=None, max_length=80)
    return_flight_number: str | None = Field(default=None, max_length=32)
    return_airline_name: str | None = Field(default=None, max_length=120)
    return_airline_logo_image_id: int | None = Field(default=None, ge=1)
    return_origin_airport: str | None = Field(default=None, max_length=160)
    return_origin_airport_code: AirportCode | None = None
    return_destination_airport: str | None = Field(default=None, max_length=160)
    return_destination_airport_code: AirportCode | None = None
    return_departure_time: time | None = None
    return_arrival_time: time | None = None
    return_baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    return_aircraft_name: str | None = Field(default=None, max_length=120)
    return_travel_class: str | None = Field(default=None, max_length=80)
    price_amount: Decimal | None = Field(default=None, ge=0)
    nights: int | None = Field(default=None, ge=1, le=365)
    currency: str = Field(default="IRR", pattern=r"^[A-Z]{3}$")
    hotel_prices: list[TourDepartureHotelPriceWrite] | None = Field(
        default=None, max_length=200
    )

    @model_validator(mode="after")
    def validate_schedule(self) -> "TourDepartureWrite":
        if (
            self.return_date
            and self.departure_date
            and self.return_date < self.departure_date
        ):
            raise ValueError("return_date cannot be before departure_date")
        if self.booking_status == "sold_out" and self.capacity_total not in (None, 0):
            self.capacity_total = 0
        if self.hotel_prices:
            base_count = sum(item.is_base_package for item in self.hotel_prices)
            if base_count > 1:
                raise ValueError("only one hotel price can be the base package")
        return self


class TourHotelPackageWrite(CatalogSchema):
    hotel_id: int = Field(ge=1)
    city: str | None = Field(default=None, max_length=100)
    nights: int = Field(ge=1, le=365)
    board_type: str | None = Field(default=None, max_length=40)
    double_price: Decimal | None = Field(default=None, ge=0)
    single_price: Decimal | None = Field(default=None, ge=0)
    child_with_bed_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_price: Decimal | None = Field(default=None, ge=0)
    max_adults: int | None = Field(default=None, ge=1, le=20)
    max_children: int | None = Field(default=None, ge=0, le=20)
    currency: str = Field(default="IRR", pattern=r"^[A-Z]{3}$")


class TourCombinedPackageHotelWrite(CatalogSchema):
    hotel_id: int = Field(ge=1)
    nights: int = Field(default=1, ge=1, le=365)
    board_type: str | None = Field(default=None, max_length=40)


class TourCombinedPackageWrite(CatalogSchema):
    id: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=1, max_length=160)
    double_price: Decimal | None = Field(default=None, ge=0)
    double_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    single_price: Decimal | None = Field(default=None, ge=0)
    single_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    child_with_bed_price: Decimal | None = Field(default=None, ge=0)
    child_with_bed_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    child_without_bed_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    infant_price: Decimal | None = Field(default=None, ge=0)
    infant_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    double_flight_price: Decimal | None = Field(default=None, ge=0)
    single_flight_price: Decimal | None = Field(default=None, ge=0)
    regular_flight_price: Decimal | None = Field(default=None, ge=0)
    regular_flight_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    child_without_bed_flight_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_flight_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    extra_price: Decimal | None = Field(default=None, ge=0)
    extra_currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    add_flight_to_double: bool = True
    add_flight_to_single: bool = True
    add_flight_to_child_with_bed: bool = True
    add_flight_to_child_without_bed: bool = True
    add_flight_to_infant: bool = False
    hotels: list[TourCombinedPackageHotelWrite] = Field(
        default_factory=list, max_length=20
    )

    @model_validator(mode="after")
    def validate_unique_hotels(self) -> "TourCombinedPackageWrite":
        hotel_ids = [item.hotel_id for item in self.hotels]
        if len(hotel_ids) != len(set(hotel_ids)):
            raise ValueError("combined package hotels must be unique")
        return self


class ArticleWrite(CatalogSchema):
    title: str = Field(min_length=2, max_length=180)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200)
    category: str = Field(min_length=2, max_length=100)
    excerpt: str = Field(min_length=10, max_length=300)
    body: str = Field(min_length=20)
    author_name: str = Field(min_length=2, max_length=120)
    internal_note: str | None = Field(default=None, max_length=5000)
    destination_id: int | None = Field(default=None, ge=1)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    status: PublicationStatus = PublicationStatus.DRAFT


class ArticleUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200
    )
    title: str | None = Field(default=None, min_length=2, max_length=180)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    excerpt: str | None = Field(default=None, min_length=10, max_length=300)
    body: str | None = Field(default=None, min_length=20)
    author_name: str | None = Field(default=None, min_length=2, max_length=120)
    internal_note: str | None = Field(default=None, max_length=5000)
    destination_id: int | None = Field(default=None, ge=1)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    status: PublicationStatus | None = None


class AdminArticle(ArticleWrite):
    id: int
    published_at: datetime | None
    updated_at: datetime


class ArticleCategoryWrite(CatalogSchema):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    internal_note: str | None = Field(default=None, max_length=5000)


class ArticleCategoryUpdate(CatalogSchema):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100
    )
    internal_note: str | None = Field(default=None, max_length=5000)


class AdminArticleCategory(ArticleCategoryWrite):
    id: int


class FAQWrite(CatalogSchema):
    question: str = Field(min_length=5, max_length=250)
    answer: str = Field(min_length=10)
    internal_note: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=100)
    destination_id: int | None = Field(default=None, ge=1)
    display_order: int = Field(default=0, ge=0, le=32767)
    status: PublicationStatus = PublicationStatus.DRAFT


class FAQUpdate(CatalogSchema):
    question: str | None = Field(default=None, min_length=5, max_length=250)
    answer: str | None = Field(default=None, min_length=10)
    internal_note: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=100)
    destination_id: int | None = Field(default=None, ge=1)
    display_order: int | None = Field(default=None, ge=0, le=32767)
    status: PublicationStatus | None = None


class AdminFAQ(FAQWrite):
    id: int
    published_at: datetime | None
    updated_at: datetime


class SiteSettingsWrite(CatalogSchema):
    site_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    address: str | None = None
    working_hours: str | None = Field(default=None, max_length=160)
    social_links: dict[str, Any] = Field(default_factory=dict)
    internal_note: str | None = Field(default=None, max_length=5000)


class SiteSettingsResponse(SiteSettingsWrite):
    id: int
    updated_at: datetime


class TourWrite(CatalogSchema):
    title: str = Field(min_length=2, max_length=180)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200)
    destination_id: int | None = Field(default=None, ge=1)
    hotel_id: int | None = Field(default=None, ge=1)
    hotel_name: str | None = Field(default=None, max_length=180)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    origin: str | None = Field(default=None, max_length=100)
    tour_type: str | None = Field(default=None, max_length=32)
    duration_days: int | None = Field(default=None, ge=1, le=365)
    departure_date: date | None = None
    price_amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default="IRR", pattern=r"^[A-Z]{3}$")
    transportation: str | None = Field(default=None, max_length=120)
    origin_airport: str | None = Field(default=None, max_length=160)
    origin_airport_code: AirportCode | None = None
    destination_airport: str | None = Field(default=None, max_length=160)
    destination_airport_code: AirportCode | None = None
    airline_name: str | None = Field(default=None, max_length=120)
    airline_logo_image_id: int | None = Field(default=None, ge=1)
    flight_number: str | None = Field(default=None, max_length=32)
    departure_time: time | None = None
    arrival_time: time | None = None
    baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    aircraft_name: str | None = Field(default=None, max_length=120)
    travel_class: str | None = Field(default=None, max_length=80)
    return_date: date | None = None
    return_origin_airport: str | None = Field(default=None, max_length=160)
    return_origin_airport_code: AirportCode | None = None
    return_destination_airport: str | None = Field(default=None, max_length=160)
    return_destination_airport_code: AirportCode | None = None
    return_airline_name: str | None = Field(default=None, max_length=120)
    return_airline_logo_image_id: int | None = Field(default=None, ge=1)
    return_flight_number: str | None = Field(default=None, max_length=32)
    return_departure_time: time | None = None
    return_arrival_time: time | None = None
    return_baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    return_aircraft_name: str | None = Field(default=None, max_length=120)
    return_travel_class: str | None = Field(default=None, max_length=80)
    destination_language: str | None = Field(default=None, max_length=80)
    destination_currency: str | None = Field(default=None, max_length=80)
    best_travel_time: str | None = Field(default=None, max_length=300)
    rating_score: Decimal | None = Field(default=None, ge=0, le=5)
    rating_count: int = Field(default=0, ge=0)
    summary: str | None = Field(default=None, max_length=300)
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    description: str | None = None
    itinerary: str | None = None
    included_services: str | None = None
    excluded_services: str | None = None
    required_documents: str | None = None
    tour_notes: str | None = None
    refund_policy: str | None = None
    installment_terms: str | None = None
    image_alt_text: str | None = Field(default=None, max_length=255)
    flight_included: bool = False
    airport_transfer_included: bool = False
    flight_price_amount: Decimal | None = Field(default=None, ge=0)
    flight_price_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    is_combined_stay: bool = False
    internal_note: str | None = Field(default=None, max_length=5000)
    stay_nights: int | None = Field(default=None, ge=1, le=365)
    max_passengers: int | None = Field(default=None, ge=1, le=1000)
    travel_legs: list[TourTravelLegWrite] = Field(default_factory=list, max_length=50)
    itinerary_days: list[TourItineraryDayWrite] = Field(
        default_factory=list, max_length=365
    )
    departures: list[TourDepartureWrite] = Field(default_factory=list, max_length=100)
    hotel_packages: list[TourHotelPackageWrite] = Field(
        default_factory=list, max_length=50
    )
    combined_packages: list[TourCombinedPackageWrite] = Field(
        default_factory=list, max_length=50
    )
    availability_status: str = Field(default="available", max_length=32)
    status: PublicationStatus = PublicationStatus.DRAFT
    is_home_recommended: bool = False
    is_featured: bool = False
    is_installment_available: bool = False
    is_direct_flight: bool = False
    is_last_minute: bool = False
    badge_label: str | None = Field(default=None, max_length=40)
    display_order: int = Field(default=0, ge=0, le=9999)

    @model_validator(mode="after")
    def validate_departure_codes(self) -> "TourWrite":
        codes = [
            item.external_code.strip().casefold()
            for item in self.departures
            if item.external_code and item.external_code.strip()
        ]
        if len(codes) != len(set(codes)):
            raise ValueError("departure external_code values must be unique")
        return self


class TourUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200
    )
    title: str | None = Field(default=None, min_length=2, max_length=180)
    destination_id: int | None = Field(default=None, ge=1)
    hotel_id: int | None = Field(default=None, ge=1)
    hotel_name: str | None = Field(default=None, max_length=180)
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    origin: str | None = Field(default=None, max_length=100)
    tour_type: str | None = Field(default=None, max_length=32)
    duration_days: int | None = Field(default=None, ge=1, le=365)
    departure_date: date | None = None
    price_amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    transportation: str | None = Field(default=None, max_length=120)
    origin_airport: str | None = Field(default=None, max_length=160)
    origin_airport_code: AirportCode | None = None
    destination_airport: str | None = Field(default=None, max_length=160)
    destination_airport_code: AirportCode | None = None
    airline_name: str | None = Field(default=None, max_length=120)
    airline_logo_image_id: int | None = Field(default=None, ge=1)
    flight_number: str | None = Field(default=None, max_length=32)
    departure_time: time | None = None
    arrival_time: time | None = None
    baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    aircraft_name: str | None = Field(default=None, max_length=120)
    travel_class: str | None = Field(default=None, max_length=80)
    return_date: date | None = None
    return_origin_airport: str | None = Field(default=None, max_length=160)
    return_origin_airport_code: AirportCode | None = None
    return_destination_airport: str | None = Field(default=None, max_length=160)
    return_destination_airport_code: AirportCode | None = None
    return_airline_name: str | None = Field(default=None, max_length=120)
    return_airline_logo_image_id: int | None = Field(default=None, ge=1)
    return_flight_number: str | None = Field(default=None, max_length=32)
    return_departure_time: time | None = None
    return_arrival_time: time | None = None
    return_baggage_allowance_kg: int | None = Field(default=None, ge=0, le=1000)
    return_aircraft_name: str | None = Field(default=None, max_length=120)
    return_travel_class: str | None = Field(default=None, max_length=80)
    destination_language: str | None = Field(default=None, max_length=80)
    destination_currency: str | None = Field(default=None, max_length=80)
    best_travel_time: str | None = Field(default=None, max_length=300)
    rating_score: Decimal | None = Field(default=None, ge=0, le=5)
    rating_count: int | None = Field(default=None, ge=0)
    summary: str | None = Field(default=None, max_length=300)
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)
    description: str | None = None
    itinerary: str | None = None
    included_services: str | None = None
    excluded_services: str | None = None
    required_documents: str | None = None
    tour_notes: str | None = None
    refund_policy: str | None = None
    installment_terms: str | None = None
    image_alt_text: str | None = Field(default=None, max_length=255)
    flight_included: bool | None = None
    airport_transfer_included: bool | None = None
    flight_price_amount: Decimal | None = Field(default=None, ge=0)
    flight_price_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    is_combined_stay: bool | None = None
    internal_note: str | None = Field(default=None, max_length=5000)
    stay_nights: int | None = Field(default=None, ge=1, le=365)
    max_passengers: int | None = Field(default=None, ge=1, le=1000)
    travel_legs: list[TourTravelLegWrite] | None = Field(default=None, max_length=50)
    itinerary_days: list[TourItineraryDayWrite] | None = Field(
        default=None, max_length=365
    )
    departures: list[TourDepartureWrite] | None = Field(default=None, max_length=100)
    hotel_packages: list[TourHotelPackageWrite] | None = Field(
        default=None, max_length=50
    )
    combined_packages: list[TourCombinedPackageWrite] | None = Field(
        default=None, max_length=50
    )
    availability_status: str | None = Field(default=None, max_length=32)
    status: PublicationStatus | None = None
    is_home_recommended: bool | None = None
    is_featured: bool | None = None
    is_installment_available: bool | None = None
    is_direct_flight: bool | None = None
    is_last_minute: bool | None = None
    badge_label: str | None = Field(default=None, max_length=40)
    display_order: int | None = Field(default=None, ge=0, le=9999)


class AdminTour(TourWrite):
    id: int
    external_crm_id: str
    crm_updated_at: datetime
    synced_at: datetime
    published_at: datetime | None


class TravelServiceWrite(CatalogSchema):
    title: str = Field(min_length=2, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)
    service_type: str = Field(pattern=r"^(flight|train|bus|hotel|visa|other)$")
    service_category: str | None = Field(default=None, max_length=40)
    summary: str = Field(min_length=10, max_length=300)
    description: str = Field(min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    country: str | None = Field(default=None, max_length=100)
    origin: str | None = Field(default=None, max_length=120)
    destination_name: str | None = Field(default=None, max_length=120)
    origin_airport: str | None = Field(default=None, max_length=160)
    origin_airport_code: AirportCode | None = None
    destination_airport: str | None = Field(default=None, max_length=160)
    destination_airport_code: AirportCode | None = None
    departure_date: date | None = None
    return_date: date | None = None
    departure_time: time | None = None
    arrival_time: time | None = None
    return_time: time | None = None
    return_arrival_time: time | None = None
    baggage_allowance: str | None = Field(default=None, max_length=120)
    provider_company: str | None = Field(default=None, max_length=160)
    provider_icon_image_id: int | None = Field(default=None, ge=1)
    origin_terminal: str | None = Field(default=None, max_length=120)
    destination_terminal: str | None = Field(default=None, max_length=120)
    transport_class: str | None = Field(default=None, max_length=120)
    refund_policy: str | None = None
    flight_class: str | None = Field(
        default=None,
        pattern=r"^(economy|premium_economy|business|first)$",
    )
    flight_number: str | None = Field(default=None, max_length=32)
    return_flight_number: str | None = Field(default=None, max_length=32)
    stops_count: int | None = Field(default=None, ge=0, le=12)
    available_seats: int | None = Field(default=None, ge=0, le=1000)
    trip_type: str | None = Field(default=None, pattern=r"^(one_way|round_trip)$")
    compartment_type: str | None = Field(default=None, pattern=r"^(regular|private)$")
    passenger_category: str | None = Field(default=None, pattern=r"^(all|women|men)$")
    car_transport: bool = False
    flight_scope: str | None = Field(
        default=None, pattern=r"^(domestic|international)$"
    )
    aircraft_model: str | None = Field(default=None, max_length=120)
    base_price: Decimal | None = Field(default=None, ge=0, max_digits=14)
    currency: str = Field(default="IRR", pattern=r"^[A-Z]{3}$")
    visa_requirements: str | None = None
    visa_document_requirements: list[str] = Field(default_factory=list, max_length=30)
    visa_type: (
        Literal["tourist", "business", "exhibition", "residency", "student"] | None
    ) = None
    visa_processing_time: str | None = Field(default=None, max_length=120)
    visa_form_url: VisaFormUrl = None
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    display_order: int = Field(default=0, ge=0, le=2147483647)
    is_featured: bool = False
    status: PublicationStatus = PublicationStatus.DRAFT
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def validate_service_details(self) -> "TravelServiceWrite":
        if (
            self.return_date
            and self.departure_date
            and self.return_date < self.departure_date
        ):
            raise ValueError("return_date cannot be before departure_date")
        if self.trip_type == "one_way":
            self.return_date = None
            self.return_time = None
            self.return_arrival_time = None
            self.return_flight_number = None
        if self.service_type == "flight" and (
            not self.origin_airport or not self.destination_airport
        ):
            raise ValueError(
                "origin_airport and destination_airport are required for flights"
            )
        if self.service_type == "visa" and not self.country:
            raise ValueError("country is required for visa services")
        if self.service_type == "visa" and not self.visa_type:
            raise ValueError("visa_type is required for visa services")
        return self


class TravelServiceUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180
    )
    title: str | None = Field(default=None, min_length=2, max_length=160)
    service_type: str | None = Field(
        default=None, pattern=r"^(flight|train|bus|hotel|visa|other)$"
    )
    service_category: str | None = Field(default=None, max_length=40)
    summary: str | None = Field(default=None, min_length=10, max_length=300)
    description: str | None = Field(default=None, min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    country: str | None = Field(default=None, max_length=100)
    origin: str | None = Field(default=None, max_length=120)
    destination_name: str | None = Field(default=None, max_length=120)
    origin_airport: str | None = Field(default=None, max_length=160)
    origin_airport_code: AirportCode | None = None
    destination_airport: str | None = Field(default=None, max_length=160)
    destination_airport_code: AirportCode | None = None
    departure_date: date | None = None
    return_date: date | None = None
    departure_time: time | None = None
    arrival_time: time | None = None
    return_time: time | None = None
    return_arrival_time: time | None = None
    baggage_allowance: str | None = Field(default=None, max_length=120)
    provider_company: str | None = Field(default=None, max_length=160)
    provider_icon_image_id: int | None = Field(default=None, ge=1)
    origin_terminal: str | None = Field(default=None, max_length=120)
    destination_terminal: str | None = Field(default=None, max_length=120)
    transport_class: str | None = Field(default=None, max_length=120)
    refund_policy: str | None = None
    flight_class: str | None = Field(
        default=None,
        pattern=r"^(economy|premium_economy|business|first)$",
    )
    flight_number: str | None = Field(default=None, max_length=32)
    return_flight_number: str | None = Field(default=None, max_length=32)
    stops_count: int | None = Field(default=None, ge=0, le=12)
    available_seats: int | None = Field(default=None, ge=0, le=1000)
    trip_type: str | None = Field(default=None, pattern=r"^(one_way|round_trip)$")
    compartment_type: str | None = Field(default=None, pattern=r"^(regular|private)$")
    passenger_category: str | None = Field(default=None, pattern=r"^(all|women|men)$")
    car_transport: bool | None = None
    flight_scope: str | None = Field(
        default=None, pattern=r"^(domestic|international)$"
    )
    aircraft_model: str | None = Field(default=None, max_length=120)
    base_price: Decimal | None = Field(default=None, ge=0, max_digits=14)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    visa_requirements: str | None = None
    visa_document_requirements: list[str] | None = Field(default=None, max_length=30)
    visa_type: (
        Literal["tourist", "business", "exhibition", "residency", "student"] | None
    ) = None
    visa_processing_time: str | None = Field(default=None, max_length=120)
    visa_form_url: VisaFormUrl = None
    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    display_order: int | None = Field(default=None, ge=0, le=2147483647)
    is_featured: bool | None = None
    status: PublicationStatus | None = None
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def validate_service_dates(self) -> "TravelServiceUpdate":
        if self.trip_type == "one_way":
            self.return_date = None
            self.return_time = None
            self.return_arrival_time = None
            self.return_flight_number = None
        if (
            self.return_date
            and self.departure_date
            and self.return_date < self.departure_date
        ):
            raise ValueError("return_date cannot be before departure_date")
        return self


class AdminTravelService(CatalogSchema):
    """Stored service data returned to admins without create-time validation."""

    title: str
    slug: str
    service_type: str
    service_category: str | None = None
    summary: str
    description: str
    internal_note: str | None = None
    country: str | None = None
    origin: str | None = None
    destination_name: str | None = None
    origin_airport: str | None = None
    origin_airport_code: str | None = None
    destination_airport: str | None = None
    destination_airport_code: str | None = None
    departure_date: date | None = None
    return_date: date | None = None
    departure_time: time | None = None
    arrival_time: time | None = None
    return_time: time | None = None
    return_arrival_time: time | None = None
    baggage_allowance: str | None = None
    provider_company: str | None = None
    provider_icon_image_id: int | None = None
    origin_terminal: str | None = None
    destination_terminal: str | None = None
    transport_class: str | None = None
    refund_policy: str | None = None
    flight_class: str | None = None
    flight_number: str | None = None
    return_flight_number: str | None = None
    stops_count: int | None = None
    available_seats: int | None = None
    trip_type: str | None = None
    compartment_type: str | None = None
    passenger_category: str | None = None
    car_transport: bool = False
    flight_scope: str | None = None
    aircraft_model: str | None = None
    base_price: Decimal | None = None
    currency: str = "IRR"
    visa_requirements: str | None = None
    visa_document_requirements: list[str] = Field(default_factory=list)
    visa_type: (
        Literal["tourist", "business", "exhibition", "residency", "student"] | None
    ) = None
    visa_processing_time: str | None = None
    visa_form_url: str | None = None
    image_id: int | None = None
    gallery_image_ids: list[int] = Field(default_factory=list)
    display_order: int = 0
    is_featured: bool = False
    status: PublicationStatus = PublicationStatus.DRAFT
    meta_title: str | None = None
    meta_description: str | None = None
    id: int
    published_at: datetime | None = None
    updated_at: datetime


class HotelRoomWrite(CatalogSchema):
    name: str = Field(min_length=1, max_length=120)
    price_amount: Decimal = Field(ge=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")


class HotelPricePeriodWrite(CatalogSchema):
    start_date: date
    end_date: date
    adult_price: Decimal = Field(ge=0)
    child_with_bed_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_price: Decimal | None = Field(default=None, ge=0)
    infant_price: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def validate_dates(self) -> "HotelPricePeriodWrite":
        if self.end_date < self.start_date:
            raise ValueError("hotel price period end date must follow start date")
        return self


def _ensure_non_overlapping_hotel_periods(
    periods: list[HotelPricePeriodWrite] | None,
) -> None:
    ordered = sorted(periods or [], key=lambda period: period.start_date)
    for previous, current in zip(ordered, ordered[1:], strict=False):
        if previous.end_date >= current.start_date:
            raise ValueError("hotel price periods must not overlap")


class HotelWrite(CatalogSchema):
    destination_id: int = Field(ge=1)
    hotel_code: str | None = Field(default=None, max_length=64)
    service_grade: str | None = Field(default=None, max_length=40)
    service_type: str | None = Field(default=None, max_length=40)
    service_category: str | None = Field(default=None, max_length=40)
    default_room_type: str | None = Field(default=None, max_length=80)
    room_types: list[HotelRoomWrite] = Field(default_factory=list, max_length=20)
    price_periods: list[HotelPricePeriodWrite] = Field(
        default_factory=list, max_length=50
    )
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200)
    star_rating: int = Field(ge=1, le=5)
    guest_rating: str | None = Field(
        default=None, pattern=r"^(excellent|good|average)$"
    )
    summary: str = Field(min_length=10, max_length=300)
    description: str = Field(min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    location_description: str | None = None
    rooms_description: str | None = None
    amenities_description: str | None = None
    dining_description: str | None = None
    booking_description: str | None = None
    pricing_description: str | None = None
    policies_description: str | None = None
    cancellation_policy: str | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    child_with_bed_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_price: Decimal | None = Field(default=None, ge=0)
    infant_price: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="IRT", pattern=r"^[A-Z]{3}$")
    max_guests: int | None = Field(default=None, ge=1, le=1000)
    region: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=300)
    image_id: int | None = Field(default=None, ge=1)
    image_alt_text: str | None = Field(default=None, max_length=255)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)
    status: PublicationStatus = PublicationStatus.DRAFT
    is_featured: bool = False

    @model_validator(mode="after")
    def validate_price_periods(self) -> "HotelWrite":
        _ensure_non_overlapping_hotel_periods(self.price_periods)
        return self


class HotelUpdate(CatalogSchema):
    slug: str | None = Field(
        default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200
    )
    destination_id: int | None = Field(default=None, ge=1)
    hotel_code: str | None = Field(default=None, max_length=64)
    service_grade: str | None = Field(default=None, max_length=40)
    service_type: str | None = Field(default=None, max_length=40)
    service_category: str | None = Field(default=None, max_length=40)
    default_room_type: str | None = Field(default=None, max_length=80)
    room_types: list[HotelRoomWrite] | None = Field(default=None, max_length=20)
    price_periods: list[HotelPricePeriodWrite] | None = Field(
        default=None, max_length=50
    )
    name: str | None = Field(default=None, min_length=2, max_length=180)
    star_rating: int | None = Field(default=None, ge=1, le=5)
    guest_rating: str | None = Field(
        default=None, pattern=r"^(excellent|good|average)$"
    )
    summary: str | None = Field(default=None, min_length=10, max_length=300)
    description: str | None = Field(default=None, min_length=20)
    internal_note: str | None = Field(default=None, max_length=5000)
    location_description: str | None = None
    rooms_description: str | None = None
    amenities_description: str | None = None
    dining_description: str | None = None
    booking_description: str | None = None
    pricing_description: str | None = None
    policies_description: str | None = None
    cancellation_policy: str | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    child_with_bed_price: Decimal | None = Field(default=None, ge=0)
    child_without_bed_price: Decimal | None = Field(default=None, ge=0)
    infant_price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    max_guests: int | None = Field(default=None, ge=1, le=1000)
    region: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=300)
    image_id: int | None = Field(default=None, ge=1)
    image_alt_text: str | None = Field(default=None, max_length=255)
    gallery_image_ids: list[int] | None = Field(default=None, max_length=6)
    status: PublicationStatus | None = None
    is_featured: bool | None = None

    @model_validator(mode="after")
    def validate_price_periods(self) -> "HotelUpdate":
        _ensure_non_overlapping_hotel_periods(self.price_periods)
        return self


class HotelMediaUpdate(CatalogSchema):
    """Image-only hotel update, independent from imported editorial fields."""

    image_id: int | None = Field(default=None, ge=1)
    gallery_image_ids: list[int] = Field(default_factory=list, max_length=6)


class AdminHotel(CatalogSchema):
    """Stored hotel data returned to admins without create-time validation."""

    destination_id: int
    hotel_code: str | None = None
    service_grade: str | None = None
    service_type: str | None = None
    service_category: str | None = None
    default_room_type: str | None = None
    room_types: list[HotelRoomWrite] = Field(default_factory=list)
    price_periods: list[HotelPricePeriodWrite] = Field(default_factory=list)
    name: str
    slug: str
    star_rating: int
    guest_rating: str | None = None
    summary: str
    description: str
    internal_note: str | None = None
    location_description: str | None = None
    rooms_description: str | None = None
    amenities_description: str | None = None
    dining_description: str | None = None
    booking_description: str | None = None
    pricing_description: str | None = None
    policies_description: str | None = None
    cancellation_policy: str | None = None
    base_price: Decimal | None = None
    child_with_bed_price: Decimal | None = None
    child_without_bed_price: Decimal | None = None
    infant_price: Decimal | None = None
    currency: str = "IRT"
    max_guests: int | None = None
    region: str | None = None
    city: str | None = None
    address: str | None = None
    image_id: int | None = None
    image_alt_text: str | None = None
    gallery_image_ids: list[int] = Field(default_factory=list)
    status: PublicationStatus = PublicationStatus.DRAFT
    is_featured: bool = False
    id: int
    published_at: datetime | None = None
    updated_at: datetime
