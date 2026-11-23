"""Public read-only catalogue endpoints."""

from datetime import date
from decimal import Decimal
from pathlib import Path as FilePath
from typing import Annotated, Literal

from anyio import to_thread
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.models import Article, ArticleCategory, MediaAsset, PublicationStatus
from app.repositories.catalog import (
    ArticleRepository,
    CountryRepository,
    DestinationRepository,
    FAQRepository,
    HotelRepository,
    SiteSettingsRepository,
    TourRepository,
    TravelServiceRepository,
)
from app.repositories.tour_card_price import public_hotel_minimums
from app.schemas.catalog import (
    ArticleCategorySummary,
    ArticleDetail,
    ArticleList,
    CountryList,
    CountrySummary,
    DestinationDetail,
    DestinationList,
    FAQList,
    HotelCountrySummary,
    HotelDetail,
    HotelList,
    HotelRoomDetail,
    HotelSummary,
    PublicSiteSettings,
    TourDetail,
    TourFilterOption,
    TourFilterOptions,
    TourList,
    TourRouteDestination,
    TourSummary,
    TravelServiceDetail,
    TravelServiceList,
)
from app.services.tour_pdf import create_tour_package_pdf

router = APIRouter(tags=["catalog"])

# Public endpoints materialize their DTOs/files inside the handler. Returning the
# connection before sending the response prevents slow clients from filling the
# pool. Authenticated and transactional routes keep their existing lifecycle.
CatalogSession = Annotated[AsyncSession, Depends(get_session, scope="function")]

_IMPORTED_ROOM_PRICE_FIELDS = (
    ("دو تخته", "double_price", "double_currency"),
    ("تک تخته", "single_price", "single_currency"),
    ("کودک با تخت", "child_with_bed_price", "child_with_bed_currency"),
    ("کودک بدون تخت", "child_without_bed_price", "child_without_bed_currency"),
)

_IMPORTED_ROOM_LABEL_ALIASES = {
    "dbl": "دو تخته",
    "sgl": "تک تخته",
    "chd w bed": "کودک با تخت",
    "child no bed": "کودک بدون تخت",
}

_SINGLE_ROOM_LABELS = {"تک تخته", "یک تخته", "sgl", "single", "single room"}


def _effective_hotel_period(item: object) -> object | None:
    """Prefer today's seasonal rate, then the first future seasonal rate."""
    today = date.today()
    periods = sorted(
        getattr(item, "price_periods", []), key=lambda period: period.start_date
    )
    return next(
        (period for period in periods if period.start_date <= today <= period.end_date),
        next((period for period in periods if period.start_date > today), None),
    )


def _hotel_period_price_update(item: object) -> dict[str, object]:
    period = _effective_hotel_period(item)
    if period is None:
        return {}
    currency = (period.currency or "IRT").upper()
    return {
        "base_price": period.adult_price,
        "child_with_bed_price": period.child_with_bed_price,
        "child_without_bed_price": period.child_without_bed_price,
        "infant_price": period.infant_price,
        "currency": "IRT" if currency in {"IRR", "RIAL"} else currency,
    }


def _hotel_summary_with_single_room_rate(
    item: object, imported_rate: tuple[Decimal, str] | None = None
) -> HotelSummary:
    """Use the Excel SGL rate as the public hotel-card price when available."""
    summary = HotelSummary.model_validate(item)
    seasonal_update = _hotel_period_price_update(item)
    if seasonal_update:
        return summary.model_copy(update=seasonal_update)
    single_room = next(
        (
            room
            for room in getattr(item, "room_types", [])
            if getattr(room, "name", "").strip().casefold() in _SINGLE_ROOM_LABELS
            and getattr(room, "price_amount", Decimal("0")) > 0
        ),
        None,
    )
    if single_room is None and imported_rate is None:
        return summary
    amount, source_currency = (
        (single_room.price_amount, single_room.currency)
        if single_room is not None
        else imported_rate
    )
    currency = (source_currency or "IRT").upper()
    return summary.model_copy(
        update={
            "base_price": amount,
            "currency": "IRT" if currency in {"IRR", "RIAL"} else currency,
        }
    )


PageSize = Annotated[
    int,
    Query(alias="pageSize", ge=1, le=100, description="Items returned per page."),
]
Offset = Annotated[
    int,
    Query(ge=0, description="Number of matching items to skip."),
]


def resolve_media_path(storage_key: str) -> tuple[FilePath, FilePath, bool]:
    media_root = FilePath(get_settings().MEDIA_ROOT).resolve()
    media_path = (media_root / storage_key).resolve()
    return media_root, media_path, media_path.is_file()


@router.get("/countries", response_model=CountryList)
async def list_countries(session: CatalogSession) -> CountryList:
    """List published countries used by the destination filter."""
    items = await CountryRepository(session).list_published()
    return CountryList(items=[CountrySummary.model_validate(item) for item in items])


@router.get("/media/{mediaId}", response_class=FileResponse)
async def get_media(
    session: CatalogSession,
    media_id: Annotated[int, Path(alias="mediaId", ge=1)],
) -> FileResponse:
    """Serve a validated uploaded image by its database identifier."""
    asset = await session.get(MediaAsset, media_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "media not found")
    # FileResponse streams after the endpoint returns. Keep only scalar metadata
    # so a slow image download cannot hold a connection from the catalogue pool.
    storage_key = asset.storage_key
    mime_type = asset.mime_type
    original_name = asset.original_name
    await session.close()
    media_root, media_path, exists = await to_thread.run_sync(
        resolve_media_path, storage_key
    )
    if media_root not in media_path.parents or not exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "media file not found")
    return FileResponse(
        media_path,
        media_type=mime_type,
        filename=original_name,
        content_disposition_type="inline",
    )


@router.get("/destinations", response_model=DestinationList)
async def list_destinations(
    session: CatalogSession,
    page_size: PageSize = 24,
    offset: Offset = 0,
    search: str | None = Query(default=None, min_length=2, max_length=100),
    country: str | None = Query(default=None, min_length=2, max_length=100),
    featured: bool | None = None,
) -> DestinationList:
    """List published destinations with bounded pagination and search."""
    items, total = await DestinationRepository(session).list_published(
        search=search,
        country=country,
        featured=featured,
        limit=page_size,
        offset=offset,
    )
    return DestinationList(items=items, total=total, limit=page_size, offset=offset)


@router.get("/destinations/{slug}", response_model=DestinationDetail)
async def get_destination(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=180)],
) -> DestinationDetail:
    """Return a published destination by its stable slug."""
    item = await DestinationRepository(session).get_published_by_slug(slug)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "destination not found")
    return DestinationDetail.model_validate(item)


@router.get("/tours", response_model=TourList)
async def list_tours(
    session: CatalogSession,
    page_size: PageSize = 24,
    offset: Offset = 0,
    destination_slug: str | None = Query(
        default=None, alias="destinationSlug", max_length=180
    ),
    country: str | None = Query(default=None, max_length=100),
    origin: str | None = Query(default=None, max_length=100),
    tour_type: str | None = Query(default=None, alias="tourType", max_length=32),
    transportation: str | None = Query(default=None, max_length=120),
    airline: str | None = Query(default=None, max_length=120),
    hotel_stars: Annotated[int | None, Query(alias="hotelStars", ge=1, le=5)] = None,
    direct_flight: bool | None = Query(default=None, alias="directFlight"),
    last_minute: bool | None = Query(default=None, alias="lastMinute"),
    search: str | None = Query(default=None, min_length=2, max_length=100),
    sort: Literal[
        "featured", "price-asc", "price-desc", "title", "departure"
    ] = "featured",
    home_recommended: bool | None = Query(default=None, alias="homeRecommended"),
    featured: bool | None = None,
    installment_only: bool | None = Query(default=None, alias="installmentOnly"),
    min_price: Annotated[Decimal | None, Query(alias="minPrice", ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(alias="maxPrice", ge=0)] = None,
    departure_from: Annotated[date | None, Query(alias="departureFrom")] = None,
    departure_to: Annotated[date | None, Query(alias="departureTo")] = None,
    passenger_count: Annotated[
        int | None, Query(alias="passengerCount", ge=1, le=20)
    ] = None,
) -> TourList:
    """List available CRM-backed tours with common catalogue filters."""
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "minPrice must be less than or equal to maxPrice",
        )
    if (
        departure_from is not None
        and departure_to is not None
        and departure_from > departure_to
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "departureFrom must be less than or equal to departureTo",
        )
    items, total = await TourRepository(session).list_available(
        destination_slug=destination_slug,
        country=country,
        origin=origin,
        tour_type=tour_type,
        transportation=transportation,
        airline=airline,
        hotel_stars=hotel_stars,
        search=search,
        sort=sort,
        featured=featured,
        home_recommended=home_recommended,
        installment_only=installment_only,
        direct_flight=direct_flight,
        last_minute=last_minute,
        min_price=min_price,
        max_price=max_price,
        departure_from=departure_from,
        departure_to=departure_to,
        passenger_count=passenger_count,
        limit=page_size,
        offset=offset,
    )
    minimums, _ = await public_hotel_minimums(session, [item.id for item in items])
    summaries = []
    route_destinations = await TourRepository(session).route_destinations(items)
    for item in items:
        summary = TourSummary.model_validate(item)
        summary.route_destinations = [
            TourRouteDestination.model_validate(destination)
            for destination in route_destinations.get(item.id, [])
        ]
        minimum = minimums.get(item.id)
        summary.price_amount = minimum[0] if minimum else None
        if minimum:
            summary.currency = minimum[1]
        summaries.append(summary)
    return TourList(items=summaries, total=total, limit=page_size, offset=offset)


@router.get("/tours/filter-options", response_model=TourFilterOptions)
async def get_tour_filter_options(session: CatalogSession) -> TourFilterOptions:
    """Return only filter choices that can currently produce tour results."""
    options = await TourRepository(session).filter_options()
    return TourFilterOptions(
        destinations=[
            TourFilterOption(value=value, label=label)
            for value, label in options["destinations"]
        ],
        origins=[
            TourFilterOption(value=value, label=label)
            for value, label in options["origins"]
        ],
        tour_types=[
            TourFilterOption(value=value, label=label)
            for value, label in options["tour_types"]
        ],
        transportations=[
            TourFilterOption(value=value, label=label)
            for value, label in options["transportations"]
        ],
        airlines=[
            TourFilterOption(value=value, label=label)
            for value, label in options["airlines"]
        ],
        hotel_stars=[
            TourFilterOption(value=value, label=label)
            for value, label in options["hotel_stars"]
        ],
    )


@router.get("/tours/{slug}/package.pdf", response_class=Response)
async def download_tour_package(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=200)],
) -> Response:
    """Download the complete public package for an available published tour."""
    tour = await TourRepository(session).get_available_by_slug(slug)
    if tour is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tour not found")
    pdf = await create_tour_package_pdf(session, tour, include_internal_note=False)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="tour-package.pdf"'},
    )


@router.get("/tours/{slug}", response_model=TourDetail)
async def get_tour(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=200)],
) -> TourDetail:
    """Return one currently available CRM-backed tour."""
    item = await TourRepository(session).get_available_by_slug(slug)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tour not found")
    detail = TourDetail.model_validate(item)
    minimums, dates = await public_hotel_minimums(session, [item.id])
    minimum = minimums.get(item.id)
    detail.price_amount = minimum[0] if minimum else None
    if minimum:
        detail.currency = minimum[1]
    for departure in detail.departures:
        minimum = dates.get(departure.id)
        departure.price_amount = minimum[0] if minimum else None
        if minimum:
            departure.currency = minimum[1]
    return detail


@router.get("/hotels", response_model=HotelList)
async def list_hotels(
    session: CatalogSession,
    page_size: PageSize = 24,
    offset: Offset = 0,
    destination_slug: str | None = Query(
        default=None, alias="destinationSlug", max_length=180
    ),
    min_stars: int | None = Query(default=None, alias="minStars", ge=1, le=5),
    featured: bool | None = None,
    country: str | None = Query(default=None, max_length=100),
    passenger_count: Annotated[
        int | None, Query(alias="passengerCount", ge=1, le=20)
    ] = None,
) -> HotelList:
    """List published hotels and include each destination without N+1 queries."""
    repository = HotelRepository(session)
    items, total = await repository.list_published(
        destination_slug=destination_slug,
        min_stars=min_stars,
        featured=featured,
        country=country,
        passenger_count=passenger_count,
        limit=page_size,
        offset=offset,
    )
    imported_rates = await repository.list_imported_single_room_rates(
        [item.id for item in items]
    )
    return HotelList(
        items=[
            _hotel_summary_with_single_room_rate(item, imported_rates.get(item.id))
            for item in items
        ],
        total=total,
        limit=page_size,
        offset=offset,
    )


@router.get("/hotels/countries", response_model=list[HotelCountrySummary])
async def hotel_country_summaries(
    session: CatalogSession,
) -> list[HotelCountrySummary]:
    """Return country counts without fetching every hotel and its room prices."""
    rows = await HotelRepository(session).country_summaries()
    return [HotelCountrySummary.model_validate(row) for row in rows]


@router.get("/hotels/{slug}", response_model=HotelDetail)
async def get_hotel(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=200)],
) -> HotelDetail:
    """Return a published hotel by its stable slug."""
    item = await HotelRepository(session).get_published_by_slug(slug)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "hotel not found")
    repository = HotelRepository(session)
    detail = HotelDetail.model_validate(item)
    seasonal_update = _hotel_period_price_update(item)
    if seasonal_update:
        detail = detail.model_copy(update=seasonal_update)
    normalized_rooms: list[HotelRoomDetail] = []
    seen_room_labels: set[str] = set()
    for room in detail.room_types:
        canonical_name = _IMPORTED_ROOM_LABEL_ALIASES.get(
            room.name.casefold(), room.name
        )
        if canonical_name.casefold() in seen_room_labels:
            continue
        seen_room_labels.add(canonical_name.casefold())
        room.name = canonical_name
        normalized_rooms.append(room)
    detail.room_types = sorted(
        normalized_rooms,
        key=lambda room: next(
            (
                index
                for index, (label, _, _) in enumerate(_IMPORTED_ROOM_PRICE_FIELDS)
                if label.casefold() == room.name.casefold()
            ),
            len(_IMPORTED_ROOM_PRICE_FIELDS),
        ),
    )
    expected_room_labels = {
        label.casefold() for label, _, _ in _IMPORTED_ROOM_PRICE_FIELDS
    }
    existing_labels = {room.name.casefold() for room in detail.room_types}
    if not expected_room_labels.issubset(existing_labels):
        seen_labels: set[str] = set(existing_labels)
        imported_rooms: list[HotelRoomDetail] = list(detail.room_types)
        imported_rates = await repository.list_imported_room_rates(item.id)
        for offer, _departure_date in imported_rates:
            imported_prices = [
                (
                    label,
                    getattr(offer, price_field),
                    getattr(offer, currency_field, None) or offer.package_currency,
                )
                for label, price_field, currency_field in _IMPORTED_ROOM_PRICE_FIELDS
            ]
            if not any(price > 0 for _, price, _ in imported_prices):
                continue
            for position, (label, amount, currency) in enumerate(imported_prices):
                if label.casefold() in seen_labels:
                    continue
                seen_labels.add(label.casefold())
                imported_rooms.append(
                    HotelRoomDetail(
                        id=-(offer.id * 10 + position + 1),
                        name=label,
                        price_amount=amount,
                        currency=currency,
                    )
                )
        detail.room_types = imported_rooms
    return detail


@router.get("/articles", response_model=ArticleList)
async def list_articles(
    session: CatalogSession,
    page_size: PageSize = 24,
    offset: Offset = 0,
    category: str | None = Query(default=None, max_length=100),
) -> ArticleList:
    items, total = await ArticleRepository(session).list_published(
        category=category, limit=page_size, offset=offset
    )
    return ArticleList(items=items, total=total, limit=page_size, offset=offset)


@router.get("/article-categories", response_model=list[ArticleCategorySummary])
async def list_public_article_categories(
    session: CatalogSession,
) -> list[ArticleCategorySummary]:
    rows = await session.scalars(
        select(ArticleCategory)
        .join(Article, Article.category == ArticleCategory.name)
        .where(Article.status == PublicationStatus.PUBLISHED)
        .distinct()
        .order_by(ArticleCategory.name)
    )
    return [ArticleCategorySummary.model_validate(row) for row in rows]


@router.get("/articles/{slug}", response_model=ArticleDetail)
async def get_article(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=200)],
) -> ArticleDetail:
    item = await ArticleRepository(session).get_published_by_slug(slug)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "article not found")
    return ArticleDetail.model_validate(item)


@router.get("/faqs", response_model=FAQList)
async def list_faqs(
    session: CatalogSession,
    page_size: PageSize = 100,
    offset: Offset = 0,
) -> FAQList:
    items, total = await FAQRepository(session).list_published(
        limit=page_size, offset=offset
    )
    return FAQList(items=items, total=total, limit=page_size, offset=offset)


@router.get("/services", response_model=TravelServiceList)
async def list_services(
    session: CatalogSession,
    page_size: PageSize = 24,
    offset: Offset = 0,
    service_type: str | None = Query(default=None, alias="type", max_length=40),
    visa_type: Literal["tourist", "business", "exhibition", "residency", "student"]
    | None = Query(default=None, alias="visaType"),
    country: str | None = Query(default=None, max_length=100),
    departure_from: Annotated[date | None, Query(alias="departureFrom")] = None,
    departure_to: Annotated[date | None, Query(alias="departureTo")] = None,
    search: str | None = Query(default=None, min_length=2, max_length=160),
    origin: str | None = Query(default=None, max_length=120),
    origin_airport: str | None = Query(
        default=None, alias="originAirport", max_length=160
    ),
    destination: str | None = Query(default=None, max_length=120),
    provider: str | None = Query(default=None, max_length=160),
    flight_class: str | None = Query(default=None, alias="flightClass", max_length=32),
    flight_scope: Literal["domestic", "international"] | None = Query(
        default=None, alias="flightScope"
    ),
    trip_type: Literal["one_way", "round_trip"] | None = Query(
        default=None, alias="tripType"
    ),
    compartment_type: Literal["regular", "private"] | None = Query(
        default=None, alias="compartmentType"
    ),
    passenger_category: Literal["all", "women", "men"] | None = Query(
        default=None, alias="passengerCategory"
    ),
    car_transport: bool | None = Query(default=None, alias="carTransport"),
    flight_number: str | None = Query(
        default=None, alias="flightNumber", max_length=32
    ),
    min_price: Annotated[Decimal | None, Query(alias="minPrice", ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(alias="maxPrice", ge=0)] = None,
    max_stops: Annotated[int | None, Query(alias="maxStops", ge=0, le=12)] = None,
    time_slot: Literal["morning", "afternoon", "night"] | None = Query(
        default=None, alias="timeSlot"
    ),
    available_only: bool | None = Query(default=None, alias="availableOnly"),
    featured: bool | None = Query(default=None),
    transport_class: str | None = Query(
        default=None, alias="transportClass", max_length=120
    ),
    sort: Literal[
        "recommended", "price-asc", "price-desc", "departure"
    ] = "recommended",
) -> TravelServiceList:
    items, total = await TravelServiceRepository(session).list_published(
        service_type=service_type,
        visa_type=visa_type,
        country=country,
        departure_from=departure_from,
        departure_to=departure_to,
        search=search,
        limit=page_size,
        offset=offset,
        origin=origin,
        origin_airport=origin_airport,
        destination=destination,
        provider=provider,
        flight_class=flight_class,
        flight_scope=flight_scope,
        trip_type=trip_type,
        compartment_type=compartment_type,
        passenger_category=passenger_category,
        car_transport=car_transport,
        flight_number=flight_number,
        min_price=min_price,
        max_price=max_price,
        max_stops=max_stops,
        time_slot=time_slot,
        available_only=available_only,
        featured=featured,
        transport_class=transport_class,
        sort=sort,
    )
    return TravelServiceList(items=items, total=total, limit=page_size, offset=offset)


@router.get("/services/{slug}", response_model=TravelServiceDetail)
async def get_service(
    session: CatalogSession,
    slug: Annotated[str, Path(min_length=1, max_length=180)],
) -> TravelServiceDetail:
    item = await TravelServiceRepository(session).get_published_by_slug(slug)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "service not found")
    return TravelServiceDetail.model_validate(item)


@router.get("/settings", response_model=PublicSiteSettings)
async def get_public_settings(session: CatalogSession) -> PublicSiteSettings:
    item = await SiteSettingsRepository(session).get_public()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "site settings not initialized")
    return PublicSiteSettings.model_validate(item)
