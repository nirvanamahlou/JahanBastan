"""Public catalogue API schemas."""

from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    """Convert snake_case model fields to API camelCase."""
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class CatalogSchema(BaseModel):
    """Shared API serialization policy."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
        populate_by_name=True,
    )


class HotelCountrySummary(CatalogSchema):
    """Lightweight directory covering all published hotels."""

    country: str
    count: int
    image_id: int | None


class DestinationSummary(CatalogSchema):
    """Published destination summary."""

    id: int
    title: str
    slug: str
    country: str
    city: str | None
    summary: str
    image_id: int | None
    best_travel_time: str | None
    is_featured: bool


class DestinationDetail(DestinationSummary):
    """Complete published destination content."""

    description: str
    attractions: str | None
    best_travel_time: str | None
    travel_tips: str | None
    meta_title: str | None
    meta_description: str | None
    gallery_image_ids: list[int]
    published_at: datetime


class TourRouteDestination(CatalogSchema):
    """A city/country included anywhere in a tour's published route."""

    id: int
    title: str
    slug: str
    country: str
    city: str | None = None


class TourSummary(CatalogSchema):
    """Available tour summary sourced from the company CRM."""

    id: int
    destination: DestinationSummary | None
    route_destinations: list[TourRouteDestination] = Field(default_factory=list)
    hotel: "TourHotelSummary | None"
    hotel_name: str | None
    image_id: int | None
    gallery_image_ids: list[int]
    status: str
    slug: str
    title: str
    origin: str | None
    tour_type: str | None
    duration_days: int | None
    departure_date: date | None
    price_amount: Decimal | None
    currency: str | None
    transportation: str | None
    origin_airport: str | None
    origin_airport_code: str | None
    destination_airport: str | None
    destination_airport_code: str | None
    airline_name: str | None
    airline_logo_image_id: int | None
    flight_number: str | None
    departure_time: time | None
    arrival_time: time | None
    baggage_allowance_kg: int | None
    aircraft_name: str | None
    travel_class: str | None
    return_date: date | None
    return_origin_airport: str | None
    return_origin_airport_code: str | None
    return_destination_airport: str | None
    return_destination_airport_code: str | None
    return_airline_name: str | None
    return_airline_logo_image_id: int | None
    return_flight_number: str | None
    return_departure_time: time | None
    return_arrival_time: time | None
    return_baggage_allowance_kg: int | None
    return_aircraft_name: str | None
    return_travel_class: str | None
    destination_language: str | None
    destination_currency: str | None
    best_travel_time: str | None
    rating_score: Decimal | None
    rating_count: int
    summary: str | None
    meta_title: str | None
    meta_description: str | None
    availability_status: str
    is_home_recommended: bool = False
    is_featured: bool
    is_installment_available: bool
    is_direct_flight: bool
    is_last_minute: bool
    badge_label: str | None
    display_order: int


class TourDetail(TourSummary):
    """Complete available tour content."""

    description: str | None
    itinerary: str | None
    included_services: str | None
    excluded_services: str | None
    required_documents: str | None
    tour_notes: str | None
    refund_policy: str | None
    installment_terms: str | None
    image_alt_text: str | None
    flight_included: bool
    airport_transfer_included: bool
    flight_price_amount: Decimal | None
    flight_price_currency: str | None
    is_combined_stay: bool
    stay_nights: int | None
    max_passengers: int | None = None
    travel_legs: list["TourTravelLegDetail"]
    itinerary_days: list["TourItineraryDayDetail"]
    departures: list["TourDepartureDetail"]
    hotel_packages: list["TourHotelPackageDetail"]
    combined_packages: list["TourCombinedPackageDetail"]
    crm_updated_at: datetime


class TourTravelLegDetail(CatalogSchema):
    display_order: int
    destination_id: int | None
    hotel_id: int | None
    title: str | None
    description: str | None
    stage_type: str | None
    duration_minutes: int | None
    travel_class: str | None
    baggage_allowance_kg: int | None
    transportation: str | None
    departure_date: date | None
    arrival_date: date | None
    departure_time: time | None
    arrival_time: time | None
    airline_name: str | None
    flight_number: str | None
    stay_nights: int | None
    origin: str | None
    origin_terminal: str | None
    destination: str | None
    destination_terminal: str | None


class TourItineraryDayDetail(CatalogSchema):
    day_number: int
    title: str
    description: str


class TourDepartureHotelPriceDetail(CatalogSchema):
    id: int
    hotel: "TourHotelSummary"
    room_type: str
    service_type: str
    external_price_code: str | None
    price_set_code: str | None
    double_price: Decimal
    single_price: Decimal
    child_with_bed_price: Decimal
    extra_price: Decimal | None = None
    extra_currency: str | None = None
    package_currency: str
    double_currency: str | None = None
    single_currency: str | None = None
    child_with_bed_currency: str | None = None
    child_without_bed_price: Decimal
    child_without_bed_currency: str
    infant_price: Decimal
    infant_currency: str
    double_flight_price: Decimal | None = Field(default=None, ge=0)
    single_flight_price: Decimal | None = Field(default=None, ge=0)
    flight_price_per_person: Decimal
    flight_currency: str
    child_with_bed_flight_price: Decimal | None = None
    child_with_bed_flight_currency: str = "IRT"
    is_available: bool = True
    is_base_package: bool = False
    capacity_total: int | None = None
    capacity_remaining: int | None = None


class TourDepartureDetail(CatalogSchema):
    id: int
    label: str
    external_code: str | None
    price_set_code: str | None
    departure_date: date | None
    return_date: date | None
    capacity_total: int | None
    capacity_remaining: int | None
    booking_status: str
    outbound_flight_number: str | None
    outbound_airline_name: str | None
    outbound_airline_logo_image_id: int | None
    outbound_origin_airport: str | None
    outbound_origin_airport_code: str | None
    outbound_destination_airport: str | None
    outbound_destination_airport_code: str | None
    outbound_departure_time: time | None
    outbound_arrival_time: time | None
    outbound_baggage_allowance_kg: int | None
    outbound_aircraft_name: str | None
    outbound_travel_class: str | None
    return_airline_name: str | None
    return_airline_logo_image_id: int | None
    return_origin_airport: str | None
    return_origin_airport_code: str | None
    return_destination_airport: str | None
    return_destination_airport_code: str | None
    return_flight_number: str | None
    return_departure_time: time | None
    return_arrival_time: time | None
    return_baggage_allowance_kg: int | None
    return_aircraft_name: str | None
    return_travel_class: str | None
    price_amount: Decimal | None
    nights: int | None
    currency: str
    hotel_prices: list[TourDepartureHotelPriceDetail]


class TourHotelPackageDetail(CatalogSchema):
    id: int
    hotel: "TourHotelSummary"
    city: str | None
    nights: int
    board_type: str | None
    double_price: Decimal | None
    single_price: Decimal | None
    child_with_bed_price: Decimal | None
    child_without_bed_price: Decimal | None
    max_adults: int | None
    max_children: int | None
    currency: str


class TourCombinedPackageHotelDetail(CatalogSchema):
    id: int
    hotel_id: int
    hotel: "TourHotelSummary"
    nights: int
    board_type: str | None


class TourCombinedDeparturePriceDetail(CatalogSchema):
    id: int
    departure_id: int
    double_price: Decimal | None
    double_currency: str
    single_price: Decimal | None
    single_currency: str
    child_with_bed_price: Decimal | None
    child_with_bed_currency: str
    child_without_bed_price: Decimal | None
    child_without_bed_currency: str
    infant_price: Decimal | None
    infant_currency: str
    infant_supplement_price: Decimal | None = None
    infant_supplement_currency: str = "IRT"
    double_flight_price: Decimal | None = Field(default=None, ge=0)
    single_flight_price: Decimal | None = Field(default=None, ge=0)
    regular_flight_price: Decimal | None
    regular_flight_currency: str
    child_with_bed_flight_price: Decimal | None
    child_with_bed_flight_currency: str
    extra_price: Decimal | None = None
    extra_currency: str = "IRT"


class TourCombinedPackageDetail(CatalogSchema):
    id: int
    title: str
    double_price: Decimal | None
    double_currency: str
    single_price: Decimal | None
    single_currency: str
    child_with_bed_price: Decimal | None
    child_with_bed_currency: str
    child_without_bed_price: Decimal | None
    child_without_bed_currency: str
    infant_price: Decimal | None
    infant_currency: str
    double_flight_price: Decimal | None = Field(default=None, ge=0)
    single_flight_price: Decimal | None = Field(default=None, ge=0)
    regular_flight_price: Decimal | None
    regular_flight_currency: str
    child_without_bed_flight_price: Decimal | None
    child_without_bed_flight_currency: str
    extra_price: Decimal | None = None
    extra_currency: str = "IRT"
    add_flight_to_double: bool
    add_flight_to_single: bool
    add_flight_to_child_with_bed: bool
    add_flight_to_child_without_bed: bool
    add_flight_to_infant: bool
    hotels: list[TourCombinedPackageHotelDetail]
    departure_prices: list[TourCombinedDeparturePriceDetail] = Field(
        default_factory=list
    )


class HotelRoomDetail(CatalogSchema):
    """A publicly visible room type and its imported or manually entered price."""

    id: int
    name: str
    price_amount: Decimal
    currency: str


class HotelPricePeriodDetail(CatalogSchema):
    id: int
    start_date: date
    end_date: date
    adult_price: Decimal
    child_with_bed_price: Decimal | None
    child_without_bed_price: Decimal | None
    infant_price: Decimal | None
    currency: str


class HotelSummary(CatalogSchema):
    """Published hotel summary."""

    id: int
    hotel_code: str | None = None
    destination: DestinationSummary
    name: str
    slug: str
    star_rating: int = Field(ge=1, le=5)
    guest_rating: str | None
    summary: str
    service_category: str | None = None
    city: str | None = None
    region: str | None = None
    address: str | None
    image_id: int | None
    image_alt_text: str | None = None
    gallery_image_ids: list[int]
    base_price: Decimal | None
    child_with_bed_price: Decimal | None = None
    child_without_bed_price: Decimal | None = None
    infant_price: Decimal | None = None
    currency: str
    max_guests: int | None = None
    is_featured: bool


class TourHotelSummary(CatalogSchema):
    id: int
    name: str
    slug: str
    star_rating: int
    default_room_type: str | None
    guest_rating: str | None
    summary: str
    region: str | None = None
    address: str | None
    amenities_description: str | None
    image_id: int | None
    gallery_image_ids: list[int]


class HotelDetail(HotelSummary):
    """Complete published hotel content."""

    description: str
    avina_profile: dict[str, str] | None = None
    location_description: str | None
    rooms_description: str | None
    amenities_description: str | None
    dining_description: str | None
    booking_description: str | None
    pricing_description: str | None
    policies_description: str | None
    cancellation_policy: str | None
    gallery_image_ids: list[int]
    room_types: list[HotelRoomDetail]
    price_periods: list[HotelPricePeriodDetail]
    published_at: datetime


class DestinationList(CatalogSchema):
    """Paginated destination collection."""

    items: list[DestinationSummary]
    total: int
    limit: int
    offset: int


class CountrySummary(CatalogSchema):
    id: int
    name: str
    slug: str
    image_id: int | None
    display_order: int
    gallery_image_ids: list[int]


class CountryList(CatalogSchema):
    items: list[CountrySummary]


class TourList(CatalogSchema):
    """Paginated tour collection."""

    items: list[TourSummary]
    total: int
    limit: int
    offset: int


class TourFilterOption(CatalogSchema):
    """A database-backed option exposed by the public tour filters."""

    value: str
    label: str


class TourFilterOptions(CatalogSchema):
    """Available filter values derived from currently published tours."""

    destinations: list[TourFilterOption]
    origins: list[TourFilterOption]
    tour_types: list[TourFilterOption]
    transportations: list[TourFilterOption]
    airlines: list[TourFilterOption]
    hotel_stars: list[TourFilterOption]


class HotelList(CatalogSchema):
    """Paginated hotel collection."""

    items: list[HotelSummary]
    total: int
    limit: int
    offset: int


class ArticleSummary(CatalogSchema):
    id: int
    title: str
    slug: str
    category: str
    excerpt: str
    author_name: str
    image_id: int | None
    published_at: datetime


class ArticleList(CatalogSchema):
    items: list[ArticleSummary]
    total: int
    limit: int
    offset: int


class ArticleCategorySummary(CatalogSchema):
    id: int
    name: str
    slug: str


class ArticleDetail(ArticleSummary):
    body: str
    gallery_image_ids: list[int]
    meta_title: str | None
    meta_description: str | None


class FAQDestinationSummary(CatalogSchema):
    title: str
    slug: str


class FAQSummary(CatalogSchema):
    id: int
    question: str
    answer: str
    category: str | None
    display_order: int
    destination: FAQDestinationSummary | None


class FAQList(CatalogSchema):
    items: list[FAQSummary]
    total: int
    limit: int
    offset: int


class TravelServiceSummary(CatalogSchema):
    id: int
    title: str
    slug: str
    service_type: str
    service_category: str | None
    summary: str
    description: str
    image_id: int | None
    display_order: int
    is_featured: bool
    country: str | None
    origin: str | None
    destination_name: str | None
    origin_airport: str | None
    origin_airport_code: str | None
    destination_airport: str | None
    destination_airport_code: str | None
    departure_date: date | None
    return_date: date | None
    departure_time: time | None
    arrival_time: time | None
    return_time: time | None
    return_arrival_time: time | None
    baggage_allowance: str | None
    provider_company: str | None
    provider_icon_image_id: int | None
    origin_terminal: str | None
    destination_terminal: str | None
    transport_class: str | None
    refund_policy: str | None
    flight_class: str | None
    flight_number: str | None
    return_flight_number: str | None
    stops_count: int | None
    available_seats: int | None
    trip_type: str | None
    compartment_type: str | None
    passenger_category: str | None
    car_transport: bool
    flight_scope: str | None
    aircraft_model: str | None
    base_price: Decimal | None
    currency: str
    visa_type: str | None
    visa_processing_time: str | None
    visa_form_url: str | None
    visa_document_requirements: list[str]


class TravelServiceList(CatalogSchema):
    items: list[TravelServiceSummary]
    total: int
    limit: int
    offset: int


class TravelServiceDetail(TravelServiceSummary):
    gallery_image_ids: list[int]
    meta_title: str | None
    meta_description: str | None
    visa_requirements: str | None


class PublicSiteSettings(CatalogSchema):
    site_name: str
    phone: str | None
    email: str | None
    address: str | None
    working_hours: str | None
    social_links: dict[str, str]
