"""Bounded editorial-content persistence for the admin API."""

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.attributes import NO_VALUE, set_committed_value

from app.models import (
    FAQ,
    Article,
    ArticleImage,
    Hotel,
    HotelImage,
    HotelPricePeriod,
    HotelRoom,
    SiteSetting,
    Tour,
    TourCombinedPackage,
    TourCombinedPackageHotel,
    TourDeparture,
    TourDepartureHotelPrice,
    TourHotelPackage,
    TourImage,
    TourItineraryDay,
    TourTravelLeg,
    TravelService,
    TravelServiceImage,
)


class EditorialRepository:
    """Keep admin editorial queries bounded and outside transport handlers."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_articles(self) -> list[Article]:
        rows = await self.session.scalars(
            select(Article)
            .options(selectinload(Article.gallery))
            .order_by(Article.updated_at.desc())
            .limit(100)
        )
        return list(rows)

    async def list_faqs(self) -> list[FAQ]:
        rows = await self.session.scalars(
            select(FAQ).order_by(FAQ.display_order, FAQ.id).limit(200)
        )
        return list(rows)

    async def get_settings(self) -> SiteSetting | None:
        return await self.session.get(SiteSetting, 1)

    async def list_tours(self) -> list[Tour]:
        rows = await self.session.scalars(
            select(Tour)
            .options(
                joinedload(Tour.destination),
                joinedload(Tour.hotel),
                selectinload(Tour.gallery),
                selectinload(Tour.itinerary_days),
                selectinload(Tour.travel_legs),
                selectinload(Tour.departures)
                .selectinload(TourDeparture.hotel_prices)
                .selectinload(TourDepartureHotelPrice.hotel),
                selectinload(Tour.hotel_packages).selectinload(TourHotelPackage.hotel),
                selectinload(Tour.combined_packages)
                .selectinload(TourCombinedPackage.hotels)
                .selectinload(TourCombinedPackageHotel.hotel),
                selectinload(Tour.combined_packages).selectinload(
                    TourCombinedPackage.departure_prices
                ),
            )
            .order_by(Tour.departure_date.desc(), Tour.id.desc())
            .limit(200)
        )
        return list(rows)

    async def get_tour(self, tour_id: int) -> Tour | None:
        return await self.session.scalar(
            select(Tour)
            .options(
                joinedload(Tour.destination),
                joinedload(Tour.hotel),
                selectinload(Tour.gallery),
                selectinload(Tour.itinerary_days),
                selectinload(Tour.travel_legs),
                selectinload(Tour.departures)
                .selectinload(TourDeparture.hotel_prices)
                .selectinload(TourDepartureHotelPrice.hotel),
                selectinload(Tour.hotel_packages).selectinload(TourHotelPackage.hotel),
                selectinload(Tour.combined_packages)
                .selectinload(TourCombinedPackage.hotels)
                .selectinload(TourCombinedPackageHotel.hotel),
                selectinload(Tour.combined_packages).selectinload(
                    TourCombinedPackage.departure_prices
                ),
            )
            .where(Tour.id == tour_id)
        )

    async def replace_tour_gallery(self, tour: Tour, image_ids: list[int]) -> None:
        requested = list(dict.fromkeys(image_ids))
        gallery_state = inspect(tour).attrs.gallery
        if gallery_state.loaded_value is NO_VALUE:
            set_committed_value(tour, "gallery", [])
            tour.gallery.extend(
                TourImage(image_id=image_id, display_order=position)
                for position, image_id in enumerate(requested)
            )
            return
        if requested == [item.image_id for item in gallery_state.loaded_value]:
            return
        tour.gallery.clear()
        await self.session.flush()
        tour.gallery.extend(
            TourImage(image_id=image_id, display_order=position)
            for position, image_id in enumerate(requested)
        )

    async def replace_tour_departures(
        self, tour: Tour, values: list[dict[str, object]]
    ) -> None:
        """Update departures by id and retain imported price rows."""
        departure_state = inspect(tour).attrs.departures
        if departure_state.loaded_value is NO_VALUE:
            set_committed_value(tour, "departures", [])
        # Free the nonnegative positions before renumbering retained rows.
        # PostgreSQL checks the unique order immediately, before orphan deletes.
        if tour.departures:
            for position, item in enumerate(tour.departures, start=1):
                item.display_order = -position
            await self.session.flush()
        existing_by_id = {item.id: item for item in tour.departures}
        retained: list[TourDeparture] = []
        for index, value in enumerate(values):
            data = dict(value)
            departure_id = data.pop("id", None)
            prices = data.pop("hotel_prices", None)
            requested_capacity = data.pop("capacity_total", None)
            departure = existing_by_id.get(departure_id)
            if departure is None:
                departure = TourDeparture(display_order=index)
                departure.capacity_total = requested_capacity
                departure.capacity_remaining = requested_capacity
            elif requested_capacity != departure.capacity_total:
                reserved = max(
                    0,
                    (departure.capacity_total or 0)
                    - (departure.capacity_remaining or 0),
                )
                departure.capacity_total = requested_capacity
                departure.capacity_remaining = (
                    None
                    if requested_capacity is None
                    else max(0, requested_capacity - reserved)
                )
            for field_name, field_value in data.items():
                setattr(departure, field_name, field_value)
            departure.display_order = index
            if prices is not None:
                price_state = inspect(departure).attrs.hotel_prices
                if price_state.loaded_value is NO_VALUE:
                    set_committed_value(departure, "hotel_prices", [])
                if departure.hotel_prices:
                    for position, item in enumerate(departure.hotel_prices, start=1):
                        item.display_order = -position
                    await self.session.flush()
                existing_prices = {item.id: item for item in departure.hotel_prices}
                existing_base_id = next(
                    (
                        item.id
                        for item in departure.hotel_prices
                        if item.is_base_package
                    ),
                    None,
                )
                requested_base_id = next(
                    (item.get("id") for item in prices if item.get("is_base_package")),
                    None,
                )
                if (
                    existing_base_id is not None
                    and requested_base_id != existing_base_id
                ):
                    for item in departure.hotel_prices:
                        item.is_base_package = False
                    await self.session.flush()
                updated_prices: list[TourDepartureHotelPrice] = []
                for price_index, price_value in enumerate(prices):
                    price_data = dict(price_value)
                    price_id = price_data.pop("id", None)
                    requested_capacity = price_data.pop("capacity_total", None)
                    price = existing_prices.get(price_id)
                    if price is None:
                        price = TourDepartureHotelPrice(display_order=price_index)
                        price.capacity_total = requested_capacity
                        price.capacity_remaining = requested_capacity
                    else:
                        previous_total = price.capacity_total
                        previous_remaining = price.capacity_remaining
                        if requested_capacity != previous_total:
                            reserved = (
                                max(0, previous_total - (previous_remaining or 0))
                                if previous_total is not None
                                else 0
                            )
                            price.capacity_total = requested_capacity
                            price.capacity_remaining = (
                                None
                                if requested_capacity is None
                                else max(0, requested_capacity - reserved)
                            )
                    for field_name, field_value in price_data.items():
                        setattr(price, field_name, field_value)
                    price.is_available = bool(
                        price.is_available
                        and (
                            price.capacity_remaining is None
                            or price.capacity_remaining > 0
                        )
                    )
                    price.display_order = price_index
                    updated_prices.append(price)
                departure.hotel_prices[:] = updated_prices
            retained.append(departure)
        tour.departures[:] = retained
        await self.session.flush()

    async def replace_tour_details(
        self,
        tour: Tour,
        *,
        travel_legs: list[dict[str, object]] | None = None,
        itinerary_days: list[dict[str, object]] | None = None,
        departures: list[dict[str, object]] | None = None,
        hotel_packages: list[dict[str, object]] | None = None,
        combined_packages: list[dict[str, object]] | None = None,
    ) -> None:
        """Replace bounded child collections without per-row lookups."""
        if departures is not None:
            await self.replace_tour_departures(tour, departures)
            departures = None
        if combined_packages is not None:
            await self.replace_tour_combined_packages(tour, combined_packages)
        replacements = (
            (travel_legs, "travel_legs", TourTravelLeg),
            (itinerary_days, "itinerary_days", TourItineraryDay),
            (departures, "departures", TourDeparture),
            (hotel_packages, "hotel_packages", TourHotelPackage),
        )
        for values, attribute_name, model in replacements:
            if values is None:
                continue
            replacement = [
                model(**value, display_order=index)
                if model is not TourItineraryDay
                else model(**value)
                for index, value in enumerate(values)
            ]
            attribute = inspect(tour).attrs[attribute_name]
            if attribute.loaded_value is NO_VALUE:
                set_committed_value(tour, attribute_name, [])
                getattr(tour, attribute_name).extend(replacement)
                continue
            collection = getattr(tour, attribute_name)
            collection.clear()
            await self.session.flush()
            collection.extend(replacement)

    async def replace_tour_combined_packages(
        self, tour: Tour, values: list[dict[str, object]]
    ) -> None:
        """Retain package identities (and imported dates) while editing a stay."""
        attribute = inspect(tour).attrs.combined_packages
        if attribute.loaded_value is NO_VALUE:
            set_committed_value(tour, "combined_packages", [])
        existing = list(tour.combined_packages)
        by_id = {item.id: item for item in existing}
        by_hotels: dict[frozenset[int], list[TourCombinedPackage]] = {}
        for item in existing:
            by_hotels.setdefault(frozenset(h.hotel_id for h in item.hotels), []).append(
                item
            )
            # Release unique order slots before reordering or inserting packages.
            item.display_order = -item.display_order - 1
        if existing:
            await self.session.flush()
        retained: list[TourCombinedPackage] = []
        for index, value in enumerate(values):
            data = dict(value)
            package_id = data.pop("id", None)
            hotel_values = [dict(h) for h in data.pop("hotels", [])]
            hotel_ids = frozenset(h["hotel_id"] for h in hotel_values)
            package = by_id.get(package_id)
            if package_id is None and len(by_hotels.get(hotel_ids, [])) == 1:
                package = by_hotels[hotel_ids][0]
            # A new hotel combination cannot inherit the previous one's prices.
            if package is not None and (
                package in retained
                or frozenset(h.hotel_id for h in package.hotels) != hotel_ids
            ):
                package = None
            if package is None:
                package = TourCombinedPackage(hotels=[])
            for field, field_value in data.items():
                setattr(package, field, field_value)
            package.display_order = index
            assignments = {h.hotel_id: h for h in package.hotels}
            for hotel_index, hotel_value in enumerate(hotel_values):
                assignment = assignments.get(hotel_value["hotel_id"])
                if assignment is None:
                    assignment = TourCombinedPackageHotel(**hotel_value)
                    package.hotels.append(assignment)
                else:
                    for field, field_value in hotel_value.items():
                        setattr(assignment, field, field_value)
                assignment.display_order = hotel_index
            retained.append(package)
        tour.combined_packages[:] = retained
        await self.session.flush()

    async def list_services(
        self, *, offset: int = 0, limit: int = 100
    ) -> list[TravelService]:
        rows = await self.session.scalars(
            select(TravelService)
            .options(selectinload(TravelService.gallery))
            .order_by(TravelService.updated_at.desc(), TravelService.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(rows)

    async def list_hotels(self, *, offset: int = 0, limit: int = 100) -> list[Hotel]:
        rows = await self.session.scalars(
            select(Hotel)
            .options(
                selectinload(Hotel.gallery),
                selectinload(Hotel.room_types),
                selectinload(Hotel.price_periods),
            )
            .order_by(Hotel.updated_at.desc(), Hotel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(rows)

    async def get_hotel(self, hotel_id: int) -> Hotel | None:
        return await self.session.scalar(
            select(Hotel)
            .options(
                selectinload(Hotel.gallery),
                selectinload(Hotel.room_types),
                selectinload(Hotel.price_periods),
            )
            .where(Hotel.id == hotel_id)
        )

    async def replace_hotel_room_types(
        self, hotel: Hotel, values: list[dict[str, object]]
    ) -> None:
        """Replace the bounded room-rate collection without per-row queries."""
        replacement = [
            HotelRoom(**value, display_order=index)
            for index, value in enumerate(values)
        ]
        room_state = inspect(hotel).attrs.room_types
        if room_state.loaded_value is NO_VALUE:
            set_committed_value(hotel, "room_types", [])
            hotel.room_types.extend(replacement)
            return
        hotel.room_types.clear()
        await self.session.flush()
        hotel.room_types.extend(replacement)

    async def replace_hotel_price_periods(
        self, hotel: Hotel, values: list[dict[str, object]]
    ) -> None:
        """Replace bounded seasonal prices without per-row queries."""
        replacement = [HotelPricePeriod(**value) for value in values]
        period_state = inspect(hotel).attrs.price_periods
        if period_state.loaded_value is NO_VALUE:
            set_committed_value(hotel, "price_periods", [])
            hotel.price_periods.extend(replacement)
            return
        hotel.price_periods.clear()
        await self.session.flush()
        hotel.price_periods.extend(replacement)

    async def replace_gallery(
        self, owner: Article | Hotel | TravelService, image_ids: list[int]
    ) -> None:
        association = {
            Article: ArticleImage,
            Hotel: HotelImage,
            TravelService: TravelServiceImage,
        }[type(owner)]
        requested = list(dict.fromkeys(image_ids))
        gallery_state = inspect(owner).attrs.gallery
        if gallery_state.loaded_value is NO_VALUE:
            set_committed_value(owner, "gallery", [])
            owner.gallery.extend(
                association(image_id=image_id, display_order=position)
                for position, image_id in enumerate(requested)
            )
            return
        if requested == [item.image_id for item in gallery_state.loaded_value]:
            return
        owner.gallery.clear()
        await self.session.flush()
        owner.gallery.extend(
            association(image_id=image_id, display_order=position)
            for position, image_id in enumerate(requested)
        )
