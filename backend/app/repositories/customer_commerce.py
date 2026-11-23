"""Database access for authenticated customer commerce and dashboard data."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import (
    CartItem,
    CustomerInsurance,
    CustomerPassenger,
    CustomerSupportRequest,
    CustomerUser,
    CustomerWallet,
    PaymentIntent,
    PublicationStatus,
    SavedTour,
    SiteSetting,
    SupportMessage,
    Tour,
    TourCombinedDeparturePrice,
    TourCombinedPackage,
    TourCombinedPackageHotel,
    TourDeparture,
    TourDepartureHotelPrice,
    TourHotelPackage,
    TravelService,
)
from app.services.currency import (
    exchange_rates_from_links,
    round_foreign_currency_up,
    to_toman,
)
from app.services.tour_availability import is_departure_bookable


def _tour_currency(currency: str | None) -> str:
    """Treat legacy local tour amounts as Toman without changing their value."""
    code = (currency or "IRT").strip().upper()
    return "IRT" if code in {"IRR", "RIAL", "TOMAN", "TMN"} else code


class CustomerCommerceRepository:
    """Keep customer commerce queries eager-loaded, private, and bounded."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ensure_wallet(self, customer_id: int) -> CustomerWallet:
        wallet = await self.session.scalar(
            select(CustomerWallet).where(CustomerWallet.customer_id == customer_id)
        )
        if wallet is None:
            wallet = CustomerWallet(customer_id=customer_id)
            self.session.add(wallet)
            await self.session.flush()
        return wallet

    async def update_profile(
        self,
        customer: CustomerUser,
        *,
        full_name: str | None,
        phone: str | None,
        emergency_phone: str | None,
        buyer_mobile: str | None,
        landline: str | None,
        postal_code: str | None,
        national_code: str | None,
        birth_date: date | None,
        address: str | None,
        bank_iban: str | None,
        bank_account_number: str | None,
        bank_card_number: str | None,
    ) -> CustomerUser:
        if full_name is not None:
            customer.full_name = full_name.strip()
        optional_values = {
            "phone": phone,
            "emergency_phone": emergency_phone,
            "buyer_mobile": buyer_mobile,
            "landline": landline,
            "postal_code": postal_code,
            "national_code": national_code,
            "birth_date": birth_date,
            "address": address,
            "bank_iban": bank_iban,
            "bank_account_number": bank_account_number,
        }
        for field_name, value in optional_values.items():
            setattr(
                customer,
                field_name,
                value.strip() or None if isinstance(value, str) else value,
            )
        if bank_card_number is not None:
            customer.bank_card_last4 = bank_card_number[-4:]
        await self.session.flush()
        return customer

    async def get_cart_items(self, customer_id: int) -> list[CartItem]:
        statement = (
            select(CartItem)
            .options(
                joinedload(CartItem.tour),
                joinedload(CartItem.travel_service),
                joinedload(CartItem.tour_departure),
                joinedload(CartItem.hotel_package).joinedload(TourHotelPackage.hotel),
                joinedload(CartItem.tour_hotel_price).joinedload(
                    TourDepartureHotelPrice.hotel
                ),
            )
            .where(CartItem.customer_id == customer_id)
            .order_by(CartItem.updated_at.desc(), CartItem.id.desc())
        )
        return list((await self.session.scalars(statement)).unique().all())

    async def add_tour(
        self,
        customer_id: int,
        tour_id: int,
        departure_id: int,
        hotel_price_id: int,
        room_selection: dict[str, int],
        cart_id: int,
    ) -> CartItem | None:
        """Add one exact date/hotel offer without trusting client prices."""
        statement = (
            select(TourDepartureHotelPrice)
            .options(
                joinedload(TourDepartureHotelPrice.hotel),
                joinedload(TourDepartureHotelPrice.departure).joinedload(
                    TourDeparture.tour
                ),
            )
            .where(
                TourDepartureHotelPrice.id == hotel_price_id,
                TourDepartureHotelPrice.departure_id == departure_id,
            )
        )
        offer = await self.session.scalar(statement)
        if offer is None or not offer.is_available:
            return None
        tour = offer.departure.tour
        if (
            offer.departure.tour_id != tour_id
            or tour.status != PublicationStatus.PUBLISHED
            or tour.availability_status != "available"
            or offer.departure.departure_date is None
            or not is_departure_bookable(offer.departure)
        ):
            return None

        quantities = {
            key: max(0, int(room_selection.get(key, 0)))
            for key in (
                "double",
                "single",
                "extra",
                "childWithBed",
                "childWithoutBed",
                "infant",
            )
        }
        if not any(quantities.values()):
            return None
        price_fields = {
            "double": "double_price",
            "single": "single_price",
            "extra": "extra_price",
            "childWithBed": "child_with_bed_price",
            "childWithoutBed": "child_without_bed_price",
            "infant": "infant_price",
        }
        if any(
            quantity > 0
            and (getattr(offer, price_fields[key], None) or Decimal(0)) <= 0
            for key, quantity in quantities.items()
        ):
            return None
        package_currency = _tour_currency(offer.package_currency)
        double_currency = _tour_currency(
            getattr(offer, "double_currency", None) or offer.package_currency
        )
        single_currency = _tour_currency(
            getattr(offer, "single_currency", None) or offer.package_currency
        )
        extra_currency = _tour_currency(
            getattr(offer, "extra_currency", None) or offer.package_currency
        )
        child_with_bed_currency = _tour_currency(
            getattr(offer, "child_with_bed_currency", None) or offer.package_currency
        )
        child_without_bed_currency = _tour_currency(offer.child_without_bed_currency)
        infant_currency = _tour_currency(offer.infant_currency)
        flight_currency = _tour_currency(offer.flight_currency)
        hotel_components = (
            (
                double_currency,
                round_foreign_currency_up(offer.double_price, double_currency)
                * quantities["double"]
                * 2,
            ),
            (
                single_currency,
                round_foreign_currency_up(offer.single_price, single_currency)
                * quantities["single"],
            ),
            (
                extra_currency,
                round_foreign_currency_up(
                    getattr(offer, "extra_price", None) or Decimal(0), extra_currency
                )
                * quantities["extra"],
            ),
            (
                child_with_bed_currency,
                round_foreign_currency_up(
                    offer.child_with_bed_price, child_with_bed_currency
                )
                * quantities["childWithBed"],
            ),
            (
                child_without_bed_currency,
                round_foreign_currency_up(
                    offer.child_without_bed_price, child_without_bed_currency
                )
                * quantities["childWithoutBed"],
            ),
            (
                infant_currency,
                round_foreign_currency_up(offer.infant_price, infant_currency)
                * quantities["infant"],
            ),
        )
        active_hotel_components = [
            (currency, amount) for currency, amount in hotel_components if amount
        ]
        hotel_currencies = {
            (currency or "IRT").upper() for currency, _amount in active_hotel_components
        }
        rates: dict[str, Decimal] | None = None
        if len(hotel_currencies) <= 1:
            hotel_currency = (
                active_hotel_components[0][0]
                if active_hotel_components
                else package_currency
            )
            hotel_amount = sum(
                (amount for _currency, amount in active_hotel_components), Decimal("0")
            )
        else:
            # Each occupancy can have its own currency. Convert selected
            # components independently before adding them to the cart total.
            settings = await self.session.get(SiteSetting, 1)
            rates = exchange_rates_from_links(settings.social_links if settings else {})
            converted_components = [
                to_toman(amount, currency, rates)
                for currency, amount in active_hotel_components
            ]
            if any(amount is None for amount in converted_components):
                return None
            hotel_amount = sum(
                (amount for amount in converted_components if amount is not None),
                Decimal("0"),
            )
            hotel_currency = "IRT"
        # Extra is an adult passenger; children use their own independent flight rate.
        # The child-with-bed flight has its own independent workbook column.
        flight_amount = sum(
            (
                round_foreign_currency_up(amount, flight_currency) * Decimal(count)
                for amount, count in (
                    (
                        getattr(offer, "double_flight_price", None)
                        if getattr(offer, "double_flight_price", None) is not None
                        else offer.flight_price_per_person,
                        quantities["double"] * 2,
                    ),
                    (
                        getattr(offer, "single_flight_price", None)
                        if getattr(offer, "single_flight_price", None) is not None
                        else offer.flight_price_per_person,
                        quantities["single"],
                    ),
                    (offer.flight_price_per_person, quantities["extra"]),
                )
            ),
            Decimal(0),
        )
        child_flight_currency = _tour_currency(
            getattr(offer, "child_with_bed_flight_currency", "IRT")
        )
        child_flight_amount = round_foreign_currency_up(
            getattr(offer, "child_with_bed_flight_price", None) or Decimal(0),
            child_flight_currency,
        ) * (
            (quantities["childWithBed"] if child_with_bed_currency != "IRT" else 0)
            + (
                quantities["childWithoutBed"]
                if child_without_bed_currency != "IRT"
                else 0
            )
        )
        if child_flight_amount:
            if not flight_amount:
                flight_amount, flight_currency = (
                    child_flight_amount,
                    child_flight_currency,
                )
            elif flight_currency == child_flight_currency:
                flight_amount += child_flight_amount
            else:
                if rates is None:
                    settings = await self.session.get(SiteSetting, 1)
                    rates = exchange_rates_from_links(
                        settings.social_links if settings else {}
                    )
                adult_total = to_toman(flight_amount, flight_currency, rates)
                child_total = to_toman(
                    child_flight_amount, child_flight_currency, rates
                )
                if adult_total is None or child_total is None:
                    return None
                flight_amount = adult_total + child_total
                flight_currency = "IRT"
        if hotel_currency == flight_currency:
            total_amount = hotel_amount + flight_amount
            total_currency = hotel_currency
        else:
            # A hotel and the bundled flight can legitimately have different
            # currencies. Persist their current, manually managed Toman total
            # whenever both rates are available instead of leaving the cart
            # price blank.
            if rates is None:
                settings = await self.session.get(SiteSetting, 1)
                rates = exchange_rates_from_links(
                    settings.social_links if settings else {}
                )
            hotel_total = to_toman(hotel_amount, hotel_currency, rates)
            flight_total = to_toman(flight_amount, flight_currency, rates)
            if hotel_total is None or flight_total is None:
                total_amount = None
                total_currency = None
            else:
                total_amount = hotel_total + flight_total
                total_currency = "IRT"
        selected_rooms = [
            f"دو تخته: {quantities['double']} اتاق، {quantities['double'] * 2} نفر"
            if quantities["double"]
            else None,
            f"یک تخته: {quantities['single']} نفر" if quantities["single"] else None,
            f"تخت اضافه: {quantities['extra']} نفر" if quantities["extra"] else None,
            f"کودک با تخت: {quantities['childWithBed']} نفر"
            if quantities["childWithBed"]
            else None,
            f"کودک بدون تخت: {quantities['childWithoutBed']} نفر"
            if quantities["childWithoutBed"]
            else None,
            f"نوزاد: {quantities['infant']} نفر" if quantities["infant"] else None,
        ]
        selection_details = " · ".join(item for item in selected_rooms if item)
        details = (
            f"{offer.departure.label} · {offer.hotel.name} · "
            f"{offer.room_type} · {offer.service_type} · {selection_details}"
        )
        item = await self.session.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart_id,
                CartItem.tour_departure_id == offer.departure_id,
                CartItem.tour_hotel_price_id == offer.id,
            )
        )
        values = {
            "room_selection": quantities,
            "details_snapshot": details,
            "hotel_amount": hotel_amount,
            "hotel_currency": hotel_currency,
            "flight_amount": flight_amount,
            "flight_currency": flight_currency,
            "price_amount": total_amount,
            "currency": total_currency,
            "image_id": offer.hotel.image_id or tour.image_id,
            "current_price_amount": total_amount,
            "current_currency": total_currency,
            "current_hotel_amount": hotel_amount,
            "current_hotel_currency": hotel_currency,
            "current_flight_amount": flight_amount,
            "current_flight_currency": flight_currency,
            "product_snapshot": {
                "title": tour.title,
                "departure": offer.departure.label,
                "hotel": offer.hotel.name,
                "roomType": offer.room_type,
                "serviceType": offer.service_type,
            },
        }
        if item is not None:
            for field_name, value in values.items():
                setattr(item, field_name, value)
            await self.session.flush()
            return item
        item = CartItem(
            customer_id=customer_id,
            cart_id=cart_id,
            item_type="tour",
            tour_id=tour.id,
            tour_departure_id=offer.departure_id,
            tour_hotel_price_id=offer.id,
            title_snapshot=tour.title,
            **values,
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def add_combined_tour(
        self,
        customer_id: int,
        tour_id: int,
        departure_id: int,
        combined_price_id: int,
        room_selection: dict[str, int],
        cart_id: int,
    ) -> CartItem | None:
        """Add one dated multi-hotel package and calculate its price server-side."""
        dated_price = await self.session.scalar(
            select(TourCombinedDeparturePrice).where(
                TourCombinedDeparturePrice.id == combined_price_id,
                TourCombinedDeparturePrice.departure_id == departure_id,
            )
        )
        if dated_price is None:
            return None
        # A missing adult flight amount means the supplier has not quoted the
        # payable package yet. Keep an explicit zero distinct: legacy offers
        # can intentionally include a zero-cost flight and remain bookable.
        if dated_price.regular_flight_price is None:
            return None
        package = await self.session.scalar(
            select(TourCombinedPackage)
            .options(
                joinedload(TourCombinedPackage.tour),
                selectinload(TourCombinedPackage.hotels).joinedload(
                    TourCombinedPackageHotel.hotel
                ),
            )
            .where(TourCombinedPackage.id == dated_price.package_id)
        )
        departure = await self.session.scalar(
            select(TourDeparture).where(TourDeparture.id == departure_id)
        )
        if (
            package is None
            or departure is None
            or package.tour_id != tour_id
            or departure.tour_id != tour_id
            or package.tour.status != PublicationStatus.PUBLISHED
            or package.tour.availability_status != "available"
            or departure.departure_date is None
            or not is_departure_bookable(departure)
        ):
            return None

        quantities = {
            key: max(0, int(room_selection.get(key, 0)))
            for key in (
                "double",
                "single",
                "extra",
                "childWithBed",
                "childWithoutBed",
                "infant",
            )
        }
        if not any(quantities.values()):
            return None
        price_fields = {
            "double": "double_price",
            "single": "single_price",
            "extra": "extra_price",
            "childWithBed": "child_with_bed_price",
            "childWithoutBed": "child_without_bed_price",
            "infant": "infant_price",
        }
        if any(
            quantity > 0
            and (getattr(dated_price, price_fields[key], None) or Decimal(0)) <= 0
            for key, quantity in quantities.items()
        ):
            return None

        currency_fields = {
            "double": "double_currency",
            "single": "single_currency",
            "extra": "extra_currency",
            "childWithBed": "child_with_bed_currency",
            "childWithoutBed": "child_without_bed_currency",
            "infant": "infant_currency",
        }
        factors = {
            "double": 2,
            "single": 1,
            "extra": 1,
            "childWithBed": 1,
            "childWithoutBed": 1,
            "infant": 1,
        }
        hotel_components: list[tuple[str, Decimal]] = []
        for key, quantity in quantities.items():
            if quantity <= 0:
                continue
            currency = _tour_currency(getattr(dated_price, currency_fields[key]))
            amount = round_foreign_currency_up(
                getattr(dated_price, price_fields[key]), currency
            ) * Decimal(quantity * factors[key])
            hotel_components.append((currency, amount))

        infant_supplement = getattr(dated_price, "infant_supplement_price", None)
        if quantities["infant"] and infant_supplement:
            supplement_currency = _tour_currency(
                getattr(dated_price, "infant_supplement_currency", "IRT")
            )
            hotel_components.append(
                (
                    supplement_currency,
                    round_foreign_currency_up(infant_supplement, supplement_currency)
                    * Decimal(quantities["infant"]),
                )
            )
        rates: dict[str, Decimal] | None = None
        hotel_currencies = {currency for currency, amount in hotel_components if amount}
        if len(hotel_currencies) == 1:
            hotel_currency = next(iter(hotel_currencies))
            hotel_amount = sum(
                (amount for _currency, amount in hotel_components), Decimal(0)
            )
        else:
            settings = await self.session.get(SiteSetting, 1)
            rates = exchange_rates_from_links(settings.social_links if settings else {})
            converted = [
                to_toman(amount, currency, rates)
                for currency, amount in hotel_components
            ]
            if any(amount is None for amount in converted):
                return None
            hotel_amount = sum(
                (amount for amount in converted if amount is not None), Decimal(0)
            )
            hotel_currency = "IRT"

        regular_flight_currency = _tour_currency(dated_price.regular_flight_currency)
        regular_flight_amount = sum(
            (
                round_foreign_currency_up(amount, regular_flight_currency)
                * Decimal(count)
                for amount, count in (
                    (
                        getattr(dated_price, "double_flight_price", None)
                        if getattr(dated_price, "double_flight_price", None) is not None
                        else dated_price.regular_flight_price,
                        quantities["double"] * 2,
                    ),
                    (
                        getattr(dated_price, "single_flight_price", None)
                        if getattr(dated_price, "single_flight_price", None) is not None
                        else dated_price.regular_flight_price,
                        quantities["single"],
                    ),
                    (dated_price.regular_flight_price, quantities["extra"]),
                )
            ),
            Decimal(0),
        )
        child_flight_currency = _tour_currency(
            dated_price.child_with_bed_flight_currency
        )
        child_flight_count = (
            quantities["childWithBed"]
            if _tour_currency(dated_price.child_with_bed_currency) != "IRT"
            else 0
        ) + (
            quantities["childWithoutBed"]
            if _tour_currency(dated_price.child_without_bed_currency)
            not in {"IRT", "IRR"}
            else 0
        )
        child_flight_amount = round_foreign_currency_up(
            dated_price.child_with_bed_flight_price or Decimal(0), child_flight_currency
        ) * Decimal(child_flight_count)
        if (
            regular_flight_amount
            and child_flight_amount
            and regular_flight_currency != child_flight_currency
        ):
            if rates is None:
                settings = await self.session.get(SiteSetting, 1)
                rates = exchange_rates_from_links(
                    settings.social_links if settings else {}
                )
            adult_total = to_toman(
                regular_flight_amount, regular_flight_currency, rates
            )
            child_total = to_toman(child_flight_amount, child_flight_currency, rates)
            if adult_total is None or child_total is None:
                return None
            flight_amount = adult_total + child_total
            flight_currency = "IRT"
        elif child_flight_amount and not regular_flight_amount:
            flight_amount, flight_currency = child_flight_amount, child_flight_currency
        else:
            flight_amount = regular_flight_amount + child_flight_amount
            flight_currency = regular_flight_currency

        if hotel_currency == flight_currency:
            total_amount = hotel_amount + flight_amount
            total_currency = hotel_currency
        else:
            if rates is None:
                settings = await self.session.get(SiteSetting, 1)
                rates = exchange_rates_from_links(
                    settings.social_links if settings else {}
                )
            hotel_total = to_toman(hotel_amount, hotel_currency, rates)
            flight_total = to_toman(flight_amount, flight_currency, rates)
            if hotel_total is None or flight_total is None:
                return None
            total_amount = hotel_total + flight_total
            total_currency = "IRT"

        hotel_names = " + ".join(assignment.hotel.name for assignment in package.hotels)
        details = f"{departure.label} · {package.title} · {hotel_names}"[:300]
        image_id = (
            next(
                (
                    assignment.hotel.image_id
                    for assignment in package.hotels
                    if assignment.hotel.image_id
                ),
                None,
            )
            or package.tour.image_id
        )
        item = await self.session.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart_id,
                CartItem.tour_departure_id == departure_id,
                CartItem.combined_departure_price_id == dated_price.id,
            )
        )
        values = {
            "room_selection": quantities,
            "details_snapshot": details,
            "hotel_amount": hotel_amount,
            "hotel_currency": hotel_currency,
            "flight_amount": flight_amount,
            "flight_currency": flight_currency,
            "price_amount": total_amount,
            "currency": total_currency,
            "image_id": image_id,
            "current_price_amount": total_amount,
            "current_currency": total_currency,
            "current_hotel_amount": hotel_amount,
            "current_hotel_currency": hotel_currency,
            "current_flight_amount": flight_amount,
            "current_flight_currency": flight_currency,
            "product_snapshot": {
                "title": package.tour.title,
                "departure": departure.label,
                "combinedPackage": package.title,
                "hotels": [assignment.hotel.name for assignment in package.hotels],
            },
        }
        if item is not None:
            for field_name, value in values.items():
                setattr(item, field_name, value)
            await self.session.flush()
            return item
        item = CartItem(
            customer_id=customer_id,
            cart_id=cart_id,
            item_type="tour",
            tour_id=package.tour_id,
            tour_departure_id=departure_id,
            combined_departure_price_id=dated_price.id,
            title_snapshot=package.tour.title,
            **values,
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def add_transport(
        self,
        customer_id: int,
        service_id: int,
        item_type: str,
        cart_id: int,
    ) -> CartItem | None:
        service = await self.session.scalar(
            select(TravelService).where(
                TravelService.id == service_id,
                TravelService.service_type == item_type,
                TravelService.status == PublicationStatus.PUBLISHED,
            )
        )
        if service is None:
            return None
        item = await self.session.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart_id,
                CartItem.travel_service_id == service_id,
            )
        )
        if item is not None:
            item.title_snapshot = service.title
            item.details_snapshot = (
                " — ".join(
                    value
                    for value in (service.origin, service.destination_name)
                    if value
                )
                or service.provider_company
            )
            item.price_amount = service.base_price
            item.currency = service.currency
            item.image_id = service.image_id
            item.current_price_amount = service.base_price
            item.current_currency = service.currency
            item.product_snapshot = {
                "title": service.title,
                "origin": service.origin,
                "destination": service.destination_name,
                "provider": service.provider_company,
            }
            await self.session.flush()
            return item
        item = CartItem(
            customer_id=customer_id,
            cart_id=cart_id,
            item_type=item_type,
            travel_service_id=service.id,
            title_snapshot=service.title,
            details_snapshot=" — ".join(
                value for value in (service.origin, service.destination_name) if value
            )
            or service.provider_company,
            price_amount=service.base_price,
            currency=service.currency,
            image_id=service.image_id,
            current_price_amount=service.base_price,
            current_currency=service.currency,
            product_snapshot={
                "title": service.title,
                "origin": service.origin,
                "destination": service.destination_name,
                "provider": service.provider_company,
            },
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def remove_cart_item(self, customer_id: int, item_id: int) -> bool:
        item = await self.session.scalar(
            select(CartItem).where(
                CartItem.id == item_id,
                CartItem.customer_id == customer_id,
            )
        )
        if item is None:
            return False
        await self.session.delete(item)
        await self.session.flush()
        return True

    async def get_saved_tours(self, customer_id: int) -> list[SavedTour]:
        statement = (
            select(SavedTour)
            .options(joinedload(SavedTour.tour))
            .where(SavedTour.customer_id == customer_id)
            .order_by(SavedTour.created_at.desc(), SavedTour.id.desc())
        )
        return list((await self.session.scalars(statement)).unique().all())

    async def save_tour(self, customer_id: int, tour_id: int) -> SavedTour | None:
        tour = await self.session.scalar(
            select(Tour).where(
                Tour.id == tour_id,
                Tour.status == PublicationStatus.PUBLISHED,
                Tour.availability_status == "available",
            )
        )
        if tour is None:
            return None
        saved = await self.session.scalar(
            select(SavedTour).where(
                SavedTour.customer_id == customer_id,
                SavedTour.tour_id == tour_id,
            )
        )
        if saved is not None:
            return saved
        saved = SavedTour(customer_id=customer_id, tour_id=tour_id)
        self.session.add(saved)
        await self.session.flush()
        return saved

    async def remove_saved_tour(self, customer_id: int, tour_id: int) -> bool:
        saved = await self.session.scalar(
            select(SavedTour).where(
                SavedTour.customer_id == customer_id,
                SavedTour.tour_id == tour_id,
            )
        )
        if saved is None:
            return False
        await self.session.delete(saved)
        await self.session.flush()
        return True

    async def list_passengers(
        self, customer_id: int, query: str | None, limit: int = 50
    ) -> list[CustomerPassenger]:
        statement = select(CustomerPassenger).where(
            CustomerPassenger.customer_id == customer_id
        )
        if query:
            normalized = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    CustomerPassenger.full_name.ilike(normalized),
                    CustomerPassenger.first_name.ilike(normalized),
                    CustomerPassenger.last_name.ilike(normalized),
                    CustomerPassenger.first_name_en.ilike(normalized),
                    CustomerPassenger.last_name_en.ilike(normalized),
                    CustomerPassenger.email.ilike(normalized),
                    CustomerPassenger.national_code.ilike(normalized),
                    CustomerPassenger.passport_number.ilike(normalized),
                )
            )
        statement = statement.order_by(
            CustomerPassenger.is_default.desc(),
            CustomerPassenger.updated_at.desc(),
            CustomerPassenger.id.desc(),
        ).limit(limit)
        return list((await self.session.scalars(statement)).all())

    async def create_passenger(
        self, customer_id: int, **values: object
    ) -> CustomerPassenger:
        if values.get("is_default"):
            await self.clear_default_passenger(customer_id)
        passenger = CustomerPassenger(customer_id=customer_id, **values)
        self.session.add(passenger)
        await self.session.flush()
        return passenger

    async def clear_default_passenger(self, customer_id: int) -> None:
        passengers = await self.session.scalars(
            select(CustomerPassenger).where(
                CustomerPassenger.customer_id == customer_id,
                CustomerPassenger.is_default.is_(True),
            )
        )
        for passenger in passengers:
            passenger.is_default = False

    async def delete_passenger(self, customer_id: int, passenger_id: int) -> bool:
        passenger = await self.session.scalar(
            select(CustomerPassenger).where(
                CustomerPassenger.id == passenger_id,
                CustomerPassenger.customer_id == customer_id,
            )
        )
        if passenger is None:
            return False
        await self.session.delete(passenger)
        await self.session.flush()
        return True

    async def list_insurances(
        self, customer_id: int, limit: int = 50
    ) -> list[CustomerInsurance]:
        statement = (
            select(CustomerInsurance)
            .where(CustomerInsurance.customer_id == customer_id)
            .order_by(
                CustomerInsurance.end_date.desc(),
                CustomerInsurance.created_at.desc(),
                CustomerInsurance.id.desc(),
            )
            .limit(limit)
        )
        return list((await self.session.scalars(statement)).all())

    async def create_insurance(
        self, customer_id: int, **values: object
    ) -> CustomerInsurance:
        insurance = CustomerInsurance(customer_id=customer_id, **values)
        self.session.add(insurance)
        await self.session.flush()
        return insurance

    async def delete_insurance(self, customer_id: int, insurance_id: int) -> bool:
        insurance = await self.session.scalar(
            select(CustomerInsurance).where(
                CustomerInsurance.id == insurance_id,
                CustomerInsurance.customer_id == customer_id,
            )
        )
        if insurance is None:
            return False
        await self.session.delete(insurance)
        await self.session.flush()
        return True

    async def create_support_request(
        self, customer_id: int, subject: str, message: str
    ) -> CustomerSupportRequest:
        request = CustomerSupportRequest(
            customer_id=customer_id,
            subject=subject,
            message=message,
            source="account",
            last_sender="customer",
        )
        request.messages = [SupportMessage(sender_type="customer", body=message)]
        self.session.add(request)
        await self.session.flush()
        return request

    async def list_support_requests(
        self, customer_id: int, limit: int = 50
    ) -> list[CustomerSupportRequest]:
        statement = (
            select(CustomerSupportRequest)
            .options(selectinload(CustomerSupportRequest.messages))
            .where(CustomerSupportRequest.customer_id == customer_id)
            .order_by(
                CustomerSupportRequest.updated_at.desc(),
                CustomerSupportRequest.id.desc(),
            )
            .limit(limit)
        )
        return list((await self.session.scalars(statement)).all())

    async def list_orders(
        self,
        customer_id: int,
        *,
        query: str | None,
        payment_status: str | None,
        date_from: date | None,
        date_to: date | None,
        limit: int = 50,
    ) -> list[PaymentIntent]:
        statement = select(PaymentIntent).where(
            PaymentIntent.customer_user_id == customer_id,
            PaymentIntent.customer_hidden_at.is_(None),
        )
        if query:
            statement = statement.where(
                PaymentIntent.crm_contract_number.ilike(f"%{query.strip()}%")
            )
        if payment_status:
            statement = statement.where(PaymentIntent.status == payment_status)
        if date_from:
            statement = statement.where(PaymentIntent.created_at >= date_from)
        if date_to:
            statement = statement.where(
                PaymentIntent.created_at < date_to.fromordinal(date_to.toordinal() + 1)
            )
        statement = statement.order_by(
            PaymentIntent.created_at.desc(), PaymentIntent.id.desc()
        ).limit(limit)
        return list((await self.session.scalars(statement)).all())

    async def archive_order(self, customer_id: int, payment_id: int) -> bool:
        """Hide one payment entry from its owner without changing payment records."""
        payment = await self.session.scalar(
            select(PaymentIntent)
            .where(
                PaymentIntent.id == payment_id,
                PaymentIntent.customer_user_id == customer_id,
                PaymentIntent.customer_hidden_at.is_(None),
            )
            .with_for_update()
        )
        if payment is None:
            return False
        payment.customer_hidden_at = datetime.now(UTC)
        await self.session.flush()
        return True
