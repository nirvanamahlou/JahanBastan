"""Efficient read repositories for the public travel catalogue."""

import re
from datetime import date, time
from decimal import Decimal

from sqlalchemy import and_, func, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.models import (
    FAQ,
    Article,
    Country,
    Destination,
    Hotel,
    PublicationStatus,
    SiteSetting,
    Tour,
    TourCombinedPackage,
    TourCombinedPackageHotel,
    TourDeparture,
    TourDepartureHotelPrice,
    TourHotelPackage,
    TourTravelLeg,
    TravelService,
)


def _catalog_search_variants(value: str) -> set[str]:
    """Return safe Persian/Latin variants for forgiving catalogue search."""
    normalized = " ".join(value.strip().replace("ي", "ی").replace("ك", "ک").split())
    if not normalized:
        return set()
    variants = {normalized}
    if normalized.endswith("ه"):
        variants.add(f"{normalized[:-1]}ا")
    elif normalized.endswith("ا"):
        variants.add(f"{normalized[:-1]}ه")
    variants.add(normalized.replace(" ", "-"))
    return variants


def _catalog_search_normalize(value: str) -> str:
    """Normalize catalog text for matching route names in tour itineraries."""
    return " ".join(
        value.strip()
        .replace("ي", "ی")
        .replace("ى", "ی")
        .replace("ك", "ک")
        .casefold()
        .split()
    )


def _route_destination_pattern(name: str) -> re.Pattern[str] | None:
    """Prepare complete-name matching independently of a tour's long text."""
    normalized_name = _catalog_search_normalize(name)
    if not normalized_name:
        return None
    return re.compile(rf"(?<!\w){re.escape(normalized_name)}(?!\w)")


def _route_text_contains_destination(route_text: str, name: str) -> bool:
    """Match a destination as a complete name, not inside another word.

    This keeps inferred multi-city tours working while preventing short place
    names such as ``کیش`` from matching airline names such as ``ترکیش``.
    """
    normalized_route_text = _catalog_search_normalize(route_text)
    pattern = _route_destination_pattern(name)
    return pattern is not None and pattern.search(normalized_route_text) is not None


_TRANSPORTATION_MODE_ALIASES = {
    "flight": ("flight", "plane", "airplane", "پرواز", "هواپیما"),
    "bus": ("bus", "اتوبوس"),
    "train": ("train", "rail", "railway", "قطار"),
}


def _normalize_transportation(value: str) -> str:
    return " ".join(
        value.strip()
        .lower()
        .replace("ي", "ی")
        .replace("ى", "ی")
        .replace("ك", "ک")
        .split()
    )


def _transportation_filter(value: str):
    """Return the canonical vehicle filter, or preserve a precise value."""
    normalized = _normalize_transportation(value)
    aliases = next(
        (
            mode_aliases
            for mode_aliases in _TRANSPORTATION_MODE_ALIASES.values()
            if normalized in mode_aliases
        ),
        None,
    )
    if aliases is None:
        return Tour.transportation == value
    return or_(*(Tour.transportation.ilike(f"%{alias}%") for alias in aliases))


def _destination_tour_filter(destination_slug: str):
    """Match a tour when the destination is its main or package stay city."""
    destination_ids = select(Destination.id).where(
        Destination.slug == destination_slug,
        Destination.status == PublicationStatus.PUBLISHED,
    )
    hotel_destination = Hotel.destination_id.in_(destination_ids)
    return or_(
        Destination.slug == destination_slug,
        Tour.hotel_packages.any(TourHotelPackage.hotel.has(hotel_destination)),
        Tour.combined_packages.any(
            TourCombinedPackage.hotels.any(
                TourCombinedPackageHotel.hotel.has(hotel_destination)
            )
        ),
    )


def _country_name_filter(
    column: ColumnElement[str], country: str
) -> ColumnElement[bool]:
    """Match country links despite surrounding spaces and Persian variants."""
    normalized_column = func.lower(
        func.trim(
            func.replace(
                func.replace(func.replace(column, "ي", "ی"), "ى", "ی"), "ك", "ک"
            )
        )
    )
    return normalized_column == _catalog_search_normalize(country)


def _country_tour_filter(country: str) -> ColumnElement[bool]:
    """Include countries visited by a combined package as well as the main stay."""
    destination_ids = select(Destination.id).where(
        _country_name_filter(Destination.country, country),
        Destination.status == PublicationStatus.PUBLISHED,
    )
    hotel_destination = Hotel.destination_id.in_(destination_ids)
    return or_(
        _country_name_filter(Destination.country, country),
        Tour.hotel_packages.any(TourHotelPackage.hotel.has(hotel_destination)),
        Tour.combined_packages.any(
            TourCombinedPackage.hotels.any(
                TourCombinedPackageHotel.hotel.has(hotel_destination)
            )
        ),
    )


class DestinationRepository:
    """Published destination queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(
        self,
        *,
        search: str | None,
        country: str | None,
        featured: bool | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Destination], int]:
        filters = [Destination.status == PublicationStatus.PUBLISHED]
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    Destination.title.ilike(pattern),
                    Destination.country.ilike(pattern),
                    Destination.city.ilike(pattern),
                )
            )
        if country:
            filters.append(_country_name_filter(Destination.country, country))
        if featured is not None:
            filters.append(Destination.is_featured == featured)
        total = await self.session.scalar(
            select(func.count(Destination.id)).where(*filters)
        )
        result = await self.session.scalars(
            select(Destination)
            .where(*filters)
            .order_by(Destination.published_at.desc(), Destination.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result), total or 0

    async def get_published_by_slug(self, slug: str) -> Destination | None:
        return await self.session.scalar(
            select(Destination)
            .options(selectinload(Destination.gallery))
            .where(
                Destination.slug == slug,
                Destination.status == PublicationStatus.PUBLISHED,
            )
        )


class TourRepository:
    """Available CRM tour projection queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def route_destinations(
        self, tours: list[Tour]
    ) -> dict[int, list[Destination]]:
        """Return every destination represented by each tour's route and stays."""
        tour_ids = [tour.id for tour in tours]
        if not tour_ids:
            return {}

        primary = (
            select(Tour.id.label("tour_id"), Destination.id.label("destination_id"))
            .join(Destination, Tour.destination_id == Destination.id)
            .where(
                Tour.id.in_(tour_ids), Destination.status == PublicationStatus.PUBLISHED
            )
        )
        travel_legs = (
            select(
                TourTravelLeg.tour_id.label("tour_id"),
                Destination.id.label("destination_id"),
            )
            .join(Destination, TourTravelLeg.destination_id == Destination.id)
            .where(
                TourTravelLeg.tour_id.in_(tour_ids),
                Destination.status == PublicationStatus.PUBLISHED,
            )
        )
        hotel_packages = (
            select(
                TourHotelPackage.tour_id.label("tour_id"),
                Destination.id.label("destination_id"),
            )
            .join(Hotel, TourHotelPackage.hotel_id == Hotel.id)
            .join(Destination, Hotel.destination_id == Destination.id)
            .where(
                TourHotelPackage.tour_id.in_(tour_ids),
                Destination.status == PublicationStatus.PUBLISHED,
            )
        )
        combined_packages = (
            select(
                TourCombinedPackage.tour_id.label("tour_id"),
                Destination.id.label("destination_id"),
            )
            .join(
                TourCombinedPackageHotel,
                TourCombinedPackageHotel.combined_package_id == TourCombinedPackage.id,
            )
            .join(Hotel, TourCombinedPackageHotel.hotel_id == Hotel.id)
            .join(Destination, Hotel.destination_id == Destination.id)
            .where(
                TourCombinedPackage.tour_id.in_(tour_ids),
                Destination.status == PublicationStatus.PUBLISHED,
            )
        )
        route = union(
            primary, travel_legs, hotel_packages, combined_packages
        ).subquery()
        rows = await self.session.execute(
            select(route.c.tour_id, Destination)
            .join(Destination, Destination.id == route.c.destination_id)
            .order_by(route.c.tour_id, Destination.id)
        )
        result: dict[int, list[Destination]] = {}
        for tour_id, destination in rows:
            result.setdefault(tour_id, []).append(destination)

        published_destinations = await self.session.scalars(
            select(Destination).where(Destination.status == PublicationStatus.PUBLISHED)
        )
        candidates = [
            (
                destination,
                tuple(
                    pattern
                    for name in (destination.title, destination.city)
                    if name
                    and (pattern := _route_destination_pattern(name)) is not None
                ),
            )
            for destination in published_destinations
        ]
        for tour in tours:
            route_text = _catalog_search_normalize(
                " ".join(
                    part
                    for part in (
                        tour.title,
                        tour.summary,
                        tour.description,
                        tour.itinerary,
                        *(day.title for day in tour.itinerary_days),
                        *(day.description for day in tour.itinerary_days),
                    )
                    if part
                )
            )
            known_ids = {destination.id for destination in result.get(tour.id, [])}
            for destination, patterns in candidates:
                if destination.id in known_ids:
                    continue
                if any(pattern.search(route_text) is not None for pattern in patterns):
                    result.setdefault(tour.id, []).append(destination)
                    known_ids.add(destination.id)
        return result

    async def list_available(
        self,
        *,
        destination_slug: str | None,
        country: str | None,
        origin: str | None,
        tour_type: str | None,
        transportation: str | None,
        airline: str | None,
        hotel_stars: int | None,
        search: str | None,
        sort: str,
        featured: bool | None,
        installment_only: bool | None,
        direct_flight: bool | None,
        last_minute: bool | None,
        min_price: Decimal | None,
        max_price: Decimal | None,
        departure_from: date | None,
        departure_to: date | None,
        limit: int,
        offset: int,
        passenger_count: int | None = None,
        home_recommended: bool | None = None,
    ) -> tuple[list[Tour], int]:
        filters = [
            Tour.availability_status == "available",
            Tour.status == PublicationStatus.PUBLISHED,
        ]
        if destination_slug:
            filters.append(_destination_tour_filter(destination_slug))
        if country:
            filters.append(_country_tour_filter(country))
        if origin:
            filters.append(Tour.origin == origin)
        if tour_type:
            filters.append(Tour.tour_type == tour_type)
        if transportation:
            filters.append(_transportation_filter(transportation))
        if airline:
            filters.append(Tour.airline_name == airline)
        if hotel_stars is not None:
            filters.append(Tour.hotel.has(Hotel.star_rating == hotel_stars))
        if search:
            search_clauses = []
            for variant in _catalog_search_variants(search):
                pattern = f"%{variant}%"
                search_clauses.extend(
                    (
                        Tour.title.ilike(pattern),
                        Tour.origin.ilike(pattern),
                        Destination.title.ilike(pattern),
                        Destination.country.ilike(pattern),
                        Destination.city.ilike(pattern),
                        Destination.slug.ilike(pattern),
                    )
                )
            if search_clauses:
                filters.append(or_(*search_clauses))
        if home_recommended is not None:
            filters.append(Tour.is_home_recommended == home_recommended)
        if featured is not None:
            filters.append(Tour.is_featured == featured)
        if installment_only:
            filters.append(Tour.is_installment_available.is_(True))
        if direct_flight is not None:
            filters.append(Tour.is_direct_flight.is_(direct_flight))
        if last_minute is not None:
            filters.append(Tour.is_last_minute.is_(last_minute))
        if min_price is not None:
            filters.append(Tour.price_amount >= min_price)
        if max_price is not None:
            filters.append(Tour.price_amount <= max_price)
        if departure_from is not None or departure_to is not None:
            legacy_dates = []
            child_dates = []
            if departure_from is not None:
                legacy_dates.append(Tour.departure_date >= departure_from)
                child_dates.append(TourDeparture.departure_date >= departure_from)
            if departure_to is not None:
                legacy_dates.append(Tour.departure_date <= departure_to)
                child_dates.append(TourDeparture.departure_date <= departure_to)
            filters.append(
                or_(
                    and_(*legacy_dates),
                    Tour.departures.any(and_(*child_dates)),
                )
            )
        if passenger_count is not None:
            filters.append(
                or_(
                    Tour.max_passengers.is_(None),
                    Tour.max_passengers >= passenger_count,
                )
            )
        base = select(Tour).outerjoin(Tour.destination).where(*filters)
        total = await self.session.scalar(
            select(func.count(Tour.id)).outerjoin(Tour.destination).where(*filters)
        )
        order_by = {
            "price-asc": (Tour.price_amount.asc().nulls_last(), Tour.id.asc()),
            "price-desc": (Tour.price_amount.desc().nulls_last(), Tour.id.asc()),
            "title": (Tour.title.asc(), Tour.id.asc()),
            "departure": (Tour.departure_date.asc().nulls_last(), Tour.id.asc()),
        }.get(
            sort,
            (
                Tour.display_order.desc(),
                Tour.is_featured.desc(),
                Tour.departure_date.asc().nulls_last(),
                Tour.id,
            ),
        )
        result = await self.session.scalars(
            base.options(
                joinedload(
                    Tour.destination.and_(
                        Destination.status == PublicationStatus.PUBLISHED
                    )
                ),
                joinedload(Tour.hotel).selectinload(Hotel.gallery),
                selectinload(Tour.gallery),
                # Route inference reads itinerary text, but cards never serialize
                # departure pricing, packages, or travel-leg relationship graphs.
                selectinload(Tour.itinerary_days),
            )
            .order_by(*order_by)
            .limit(limit)
            .offset(offset)
        )
        return list(result.unique()), total or 0

    async def filter_options(self) -> dict[str, list[tuple[str, str]]]:
        """Return distinct values from the same published, available scope."""
        filters = [
            Tour.availability_status == "available",
            Tour.status == PublicationStatus.PUBLISHED,
        ]
        primary_destinations = (
            select(Destination.slug, Destination.title)
            .select_from(Tour)
            .join(Destination, Tour.destination_id == Destination.id)
            .where(*filters, Destination.status == PublicationStatus.PUBLISHED)
        )
        hotel_package_destinations = (
            select(Destination.slug, Destination.title)
            .select_from(Tour)
            .join(TourHotelPackage, TourHotelPackage.tour_id == Tour.id)
            .join(Hotel, TourHotelPackage.hotel_id == Hotel.id)
            .join(Destination, Hotel.destination_id == Destination.id)
            .where(*filters, Destination.status == PublicationStatus.PUBLISHED)
        )
        combined_package_destinations = (
            select(Destination.slug, Destination.title)
            .select_from(Tour)
            .join(TourCombinedPackage, TourCombinedPackage.tour_id == Tour.id)
            .join(
                TourCombinedPackageHotel,
                TourCombinedPackageHotel.combined_package_id == TourCombinedPackage.id,
            )
            .join(Hotel, TourCombinedPackageHotel.hotel_id == Hotel.id)
            .join(Destination, Hotel.destination_id == Destination.id)
            .where(*filters, Destination.status == PublicationStatus.PUBLISHED)
        )
        destination_rows = union(
            primary_destinations,
            hotel_package_destinations,
            combined_package_destinations,
        ).subquery()
        destinations = await self.session.execute(
            select(destination_rows.c.slug, destination_rows.c.title)
            .order_by(destination_rows.c.title)
            .limit(100)
        )

        async def distinct_values(column: object) -> list[tuple[str, str]]:
            rows = await self.session.scalars(
                select(column)
                .where(*filters, column.is_not(None))  # type: ignore[attr-defined]
                .distinct()
                .order_by(column)
                .limit(100)
            )
            return [(value, value) for value in rows if value]

        hotel_stars = await self.session.scalars(
            select(Hotel.star_rating)
            .join(Tour, Tour.hotel_id == Hotel.id)
            .where(*filters)
            .distinct()
            .order_by(Hotel.star_rating.desc())
            .limit(5)
        )
        return {
            "destinations": list(destinations.tuples()),
            "origins": await distinct_values(Tour.origin),
            "tour_types": await distinct_values(Tour.tour_type),
            "transportations": await distinct_values(Tour.transportation),
            "airlines": await distinct_values(Tour.airline_name),
            "hotel_stars": [
                (str(stars), f"{stars} ستاره") for stars in hotel_stars if stars
            ],
        }

    async def get_available_by_slug(self, slug: str) -> Tour | None:
        return await self.session.scalar(
            select(Tour)
            .options(
                joinedload(
                    Tour.destination.and_(
                        Destination.status == PublicationStatus.PUBLISHED
                    )
                ),
                joinedload(Tour.hotel).selectinload(Hotel.gallery),
                selectinload(Tour.gallery),
                selectinload(Tour.itinerary_days),
                selectinload(Tour.travel_legs),
                selectinload(Tour.departures)
                .selectinload(TourDeparture.hotel_prices)
                .selectinload(TourDepartureHotelPrice.hotel)
                .selectinload(Hotel.gallery),
                selectinload(Tour.hotel_packages)
                .selectinload(TourHotelPackage.hotel)
                .selectinload(Hotel.gallery),
                selectinload(Tour.combined_packages)
                .selectinload(TourCombinedPackage.hotels)
                .selectinload(TourCombinedPackageHotel.hotel)
                .selectinload(Hotel.gallery),
                selectinload(Tour.combined_packages).selectinload(
                    TourCombinedPackage.departure_prices
                ),
            )
            .where(
                Tour.slug == slug,
                Tour.availability_status == "available",
                Tour.status == PublicationStatus.PUBLISHED,
            )
        )


class HotelRepository:
    """Published hotel queries with eager-loaded destinations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def country_summaries(self) -> list[dict[str, object]]:
        """Aggregate the homepage directory without loading hotel relationships."""
        result = await self.session.execute(
            select(
                Destination.country.label("country"),
                func.count(Hotel.id).label("count"),
                func.min(Hotel.image_id).label("image_id"),
            )
            .join(Hotel, Hotel.destination_id == Destination.id)
            .where(
                Hotel.status == PublicationStatus.PUBLISHED,
                Destination.status == PublicationStatus.PUBLISHED,
            )
            .group_by(Destination.country)
            .order_by(Destination.country)
        )
        return [dict(row) for row in result.mappings()]

    async def list_published(
        self,
        *,
        destination_slug: str | None,
        min_stars: int | None,
        featured: bool | None,
        country: str | None,
        limit: int,
        offset: int,
        passenger_count: int | None = None,
        query: str | None = None,
    ) -> tuple[list[Hotel], int]:
        filters = [
            Hotel.status == PublicationStatus.PUBLISHED,
            Destination.status == PublicationStatus.PUBLISHED,
        ]
        if query and (term := query.strip()):
            normalized = term.replace("ي", "ی").replace("ك", "ک")
            fields = (Hotel.name, Hotel.region, Destination.title, Destination.country,
                      Hotel.avina_profile["englishName"].as_string())
            filters.append(or_(*(
                func.replace(func.replace(field, "ي", "ی"), "ك", "ک")
                .icontains(normalized, autoescape=True)
                for field in fields
            )))
        if destination_slug:
            filters.append(Destination.slug == destination_slug)
        if min_stars is not None:
            filters.append(Hotel.star_rating >= min_stars)
        if featured is not None:
            filters.append(Hotel.is_featured == featured)
        if country:
            filters.append(_country_name_filter(Destination.country, country))
        if passenger_count is not None:
            filters.append(
                or_(Hotel.max_guests.is_(None), Hotel.max_guests >= passenger_count)
            )
        total = await self.session.scalar(
            select(func.count(Hotel.id)).join(Hotel.destination).where(*filters)
        )
        result = await self.session.scalars(
            select(Hotel)
            .join(Hotel.destination)
            .options(
                joinedload(Hotel.destination),
                selectinload(Hotel.gallery),
                selectinload(Hotel.room_types),
                selectinload(Hotel.price_periods),
            )
            .where(*filters)
            .order_by(Hotel.is_featured.desc(), Hotel.star_rating.desc(), Hotel.id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.unique()), total or 0

    async def list_imported_single_room_rates(
        self, hotel_ids: list[int]
    ) -> dict[int, tuple[Decimal, str]]:
        """Return the newest non-zero SGL price for each hotel in one query."""
        if not hotel_ids:
            return {}
        rows = await self.session.scalars(
            select(TourDepartureHotelPrice)
            .join(TourDeparture)
            .where(TourDepartureHotelPrice.hotel_id.in_(hotel_ids))
            .order_by(
                TourDepartureHotelPrice.hotel_id,
                TourDeparture.departure_date.desc().nullslast(),
                TourDepartureHotelPrice.id.desc(),
            )
        )
        rates: dict[int, tuple[Decimal, str]] = {}
        for row in rows:
            if row.hotel_id not in rates and row.single_price > 0:
                rates[row.hotel_id] = (
                    row.single_price,
                    getattr(row, "single_currency", None)
                    or row.package_currency
                    or "IRT",
                )
        return rates

    async def list_imported_room_rates(
        self, hotel_id: int
    ) -> list[tuple[TourDepartureHotelPrice, date | None]]:
        """Return the newest Excel-backed offer rows for a hotel."""
        result = await self.session.execute(
            select(TourDepartureHotelPrice, TourDeparture.departure_date)
            .join(
                TourDeparture,
                TourDeparture.id == TourDepartureHotelPrice.departure_id,
            )
            .where(TourDepartureHotelPrice.hotel_id == hotel_id)
            .order_by(
                TourDeparture.departure_date.desc().nullslast(),
                TourDeparture.id.desc(),
                TourDepartureHotelPrice.display_order,
            )
        )
        return list(result.all())

    async def get_published_by_slug(self, slug: str) -> Hotel | None:
        return await self.session.scalar(
            select(Hotel)
            .options(
                joinedload(Hotel.destination),
                selectinload(Hotel.gallery),
                selectinload(Hotel.room_types),
                selectinload(Hotel.price_periods),
            )
            .where(
                Hotel.slug == slug,
                Hotel.status == PublicationStatus.PUBLISHED,
                Destination.status == PublicationStatus.PUBLISHED,
            )
            .join(Hotel.destination)
        )


class ArticleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(
        self, *, category: str | None, limit: int, offset: int
    ) -> tuple[list[Article], int]:
        filters = [Article.status == PublicationStatus.PUBLISHED]
        if category:
            filters.append(Article.category == category)
        total = await self.session.scalar(
            select(func.count(Article.id)).where(*filters)
        )
        rows = await self.session.scalars(
            select(Article)
            .where(*filters)
            .order_by(Article.published_at.desc(), Article.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(rows), total or 0

    async def get_published_by_slug(self, slug: str) -> Article | None:
        return await self.session.scalar(
            select(Article)
            .options(selectinload(Article.gallery))
            .where(
                Article.slug == slug,
                Article.status == PublicationStatus.PUBLISHED,
            )
        )


class FAQRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(self, *, limit: int, offset: int) -> tuple[list[FAQ], int]:
        filters = [FAQ.status == PublicationStatus.PUBLISHED]
        total = await self.session.scalar(select(func.count(FAQ.id)).where(*filters))
        rows = await self.session.scalars(
            select(FAQ)
            .options(
                joinedload(
                    FAQ.destination.and_(
                        Destination.status == PublicationStatus.PUBLISHED
                    )
                )
            )
            .where(*filters)
            .order_by(FAQ.display_order, FAQ.id)
            .limit(limit)
            .offset(offset)
        )
        return list(rows.unique()), total or 0


class TravelServiceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(
        self,
        *,
        service_type: str | None,
        visa_type: str | None = None,
        country: str | None,
        departure_from: date | None,
        departure_to: date | None,
        search: str | None,
        limit: int,
        offset: int,
        origin: str | None = None,
        origin_airport: str | None = None,
        destination: str | None = None,
        provider: str | None = None,
        flight_class: str | None = None,
        flight_scope: str | None = None,
        trip_type: str | None = None,
        compartment_type: str | None = None,
        passenger_category: str | None = None,
        car_transport: bool | None = None,
        flight_number: str | None = None,
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
        max_stops: int | None = None,
        time_slot: str | None = None,
        available_only: bool | None = None,
        transport_class: str | None = None,
        featured: bool | None = None,
        sort: str = "recommended",
    ) -> tuple[list[TravelService], int]:
        filters = [TravelService.status == PublicationStatus.PUBLISHED]
        if service_type:
            filters.append(TravelService.service_type == service_type)
        if visa_type:
            filters.append(TravelService.visa_type == visa_type)
        if country:
            filters.append(_country_name_filter(TravelService.country, country))
        if departure_from:
            filters.append(TravelService.departure_date == departure_from)
        if departure_to and trip_type == "round_trip":
            filters.append(
                or_(
                    TravelService.return_date == departure_to,
                    TravelService.return_date.is_(None),
                )
            )
        if origin:
            origin_pattern = f"%{origin}%"
            filters.append(
                or_(
                    TravelService.origin.ilike(origin_pattern),
                    TravelService.origin_airport.ilike(origin_pattern),
                )
            )
        if origin_airport:
            filters.append(TravelService.origin_airport.ilike(f"%{origin_airport}%"))
        if destination:
            destination_pattern = f"%{destination}%"
            filters.append(
                or_(
                    TravelService.destination_name.ilike(destination_pattern),
                    TravelService.destination_airport.ilike(destination_pattern),
                )
            )
        if provider:
            filters.append(TravelService.provider_company.ilike(f"%{provider}%"))
        if flight_class:
            filters.append(TravelService.flight_class == flight_class)
        if flight_scope:
            filters.append(TravelService.flight_scope == flight_scope)
        if trip_type:
            filters.append(TravelService.trip_type == trip_type)
        if compartment_type:
            filters.append(TravelService.compartment_type == compartment_type)
        if passenger_category:
            filters.append(TravelService.passenger_category == passenger_category)
        if car_transport is not None:
            filters.append(TravelService.car_transport == car_transport)
        if flight_number:
            number_pattern = f"%{flight_number}%"
            filters.append(
                or_(
                    TravelService.flight_number.ilike(number_pattern),
                    TravelService.return_flight_number.ilike(number_pattern),
                )
            )
        if min_price is not None:
            filters.append(TravelService.base_price >= min_price)
        if max_price is not None:
            filters.append(TravelService.base_price <= max_price)
        if max_stops is not None:
            filters.append(TravelService.stops_count <= max_stops)
        time_ranges = {
            "morning": (time(5, 0), time(12, 0)),
            "afternoon": (time(12, 0), time(18, 0)),
            "night": (time(18, 0), time(23, 59, 59)),
        }
        if time_slot in time_ranges:
            start, end = time_ranges[time_slot]
            filters.extend(
                [
                    TravelService.departure_time >= start,
                    TravelService.departure_time <= end,
                ]
            )
        if available_only:
            filters.append(
                or_(
                    TravelService.available_seats.is_(None),
                    TravelService.available_seats > 0,
                )
            )
        if featured is not None:
            filters.append(TravelService.is_featured == featured)
        if transport_class:
            filters.append(
                TravelService.transport_class.ilike(f"%{transport_class.strip()}%")
            )
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    TravelService.title.ilike(pattern),
                    TravelService.summary.ilike(pattern),
                    TravelService.destination_name.ilike(pattern),
                    TravelService.origin_airport.ilike(pattern),
                    TravelService.destination_airport.ilike(pattern),
                    TravelService.provider_company.ilike(pattern),
                )
            )
        total = await self.session.scalar(
            select(func.count(TravelService.id)).where(*filters)
        )
        order_by = {
            "price-asc": (TravelService.base_price.asc().nullslast(), TravelService.id),
            "price-desc": (
                TravelService.base_price.desc().nullslast(),
                TravelService.id,
            ),
            "departure": (
                TravelService.departure_date.asc().nullslast(),
                TravelService.id,
            ),
        }.get(
            sort,
            (
                TravelService.is_featured.desc(),
                TravelService.display_order,
                TravelService.id,
            ),
        )
        rows = await self.session.scalars(
            select(TravelService)
            .where(*filters)
            .order_by(*order_by)
            .limit(limit)
            .offset(offset)
        )
        return list(rows), total or 0

    async def get_published_by_slug(self, slug: str) -> TravelService | None:
        return await self.session.scalar(
            select(TravelService)
            .options(selectinload(TravelService.gallery))
            .where(
                TravelService.slug == slug,
                TravelService.status == PublicationStatus.PUBLISHED,
            )
        )


class SiteSettingsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_public(self) -> SiteSetting | None:
        return await self.session.get(SiteSetting, 1)


class CountryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(self) -> list[Country]:
        rows = await self.session.scalars(
            select(Country)
            .options(selectinload(Country.gallery))
            .where(Country.status == PublicationStatus.PUBLISHED)
            .order_by(Country.display_order, Country.name)
            .limit(100)
        )
        return list(rows)
