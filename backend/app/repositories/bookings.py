"""Transactional booking request persistence."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from secrets import token_hex
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import (
    BookingItem,
    BookingRequest,
    CartEvent,
    CartItem,
    CustomerCart,
    DiscountCode,
    PaymentIntent,
    PaymentStatus,
    SiteSetting,
    TourCombinedDeparturePrice,
    TourDeparture,
    TourDepartureHotelPrice,
)
from app.models.checkout import BookingStatusEvent
from app.repositories.agencies import AgencyRepository
from app.services.currency import exchange_rates_from_links, item_total_to_toman
from app.services.tour_availability import is_departure_bookable


class HotelUnavailableError(ValueError):
    """Selected tour hotel became unavailable after it was added to the cart."""

    def __init__(self, alternatives: list[dict[str, Any]]) -> None:
        super().__init__("هتل انتخابی برای این تاریخ تکمیل ظرفیت شده است.")
        self.alternatives = alternatives


class BookingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _options():
        return (
            selectinload(BookingRequest.items),
            selectinload(BookingRequest.tickets),
            joinedload(BookingRequest.customer),
        )

    @staticmethod
    def _required_rooms(item: Any) -> int:
        selection = item.room_selection or {}
        return max(
            1,
            int(selection.get("double", 0) or 0) + int(selection.get("single", 0) or 0),
        )

    @staticmethod
    def _required_passengers(item: Any) -> int:
        selection = item.room_selection or {}
        return max(
            1,
            int(selection.get("double", 0) or 0) * 2
            + sum(
                int(selection.get(key, 0) or 0)
                for key in (
                    "single",
                    "extra",
                    "childWithBed",
                    "childWithoutBed",
                    "infant",
                )
            ),
        )

    async def expire_overdue_invoices(self) -> int:
        bookings = list(
            (
                await self.session.scalars(
                    select(BookingRequest)
                    .options(selectinload(BookingRequest.items))
                    .where(
                        BookingRequest.status.in_(("pending_review", "approved")),
                        BookingRequest.payment_expires_at.is_not(None),
                        BookingRequest.payment_expires_at <= datetime.now(UTC),
                    )
                    .with_for_update(skip_locked=True)
                )
            )
            .unique()
            .all()
        )
        for booking in bookings:
            previous_status = booking.status
            await self.release_booking_capacity(booking)
            await self.release_booking_discount(booking)
            await AgencyRepository(self.session).release_booking_reservation(booking)
            booking.status = "expired"
            booking.checkout_step = "expired"
            self.session.add(
                BookingStatusEvent(
                    booking_id=booking.id,
                    actor_type="system",
                    actor_id=None,
                    event_type="payment_window_expired",
                    from_status=previous_status,
                    to_status="expired",
                    note=(
                        "Payment window expired; capacity and discount usage released."
                    ),
                    payload={
                        "capacityReleased": booking.capacity_released_at is not None
                    },
                )
            )
        await self.session.commit()
        return len(bookings)

    async def release_booking_discount(self, booking: BookingRequest) -> None:
        """Return one reserved promotion use when a booking cannot be completed."""
        if not booking.discount_code:
            return
        discount = await self.session.scalar(
            select(DiscountCode)
            .where(DiscountCode.code == booking.discount_code)
            .with_for_update()
        )
        if discount is not None and discount.used_count > 0:
            discount.used_count -= 1

    async def _get_offer_for_update(
        self, offer_id: int
    ) -> TourDepartureHotelPrice | None:
        locked_id = await self.session.scalar(
            select(TourDepartureHotelPrice.id)
            .where(TourDepartureHotelPrice.id == offer_id)
            .with_for_update()
        )
        if locked_id is None:
            return None
        return await self.session.scalar(
            select(TourDepartureHotelPrice)
            .options(
                joinedload(TourDepartureHotelPrice.hotel),
                joinedload(TourDepartureHotelPrice.departure).joinedload(
                    TourDeparture.tour
                ),
            )
            .where(TourDepartureHotelPrice.id == offer_id)
        )

    async def _get_combined_offer_for_update(
        self, price_id: int
    ) -> tuple[TourCombinedDeparturePrice, TourDeparture] | None:
        price = await self.session.scalar(
            select(TourCombinedDeparturePrice)
            .where(TourCombinedDeparturePrice.id == price_id)
            .with_for_update()
        )
        if price is None:
            return None
        departure = await self.session.scalar(
            select(TourDeparture)
            .where(TourDeparture.id == price.departure_id)
            .with_for_update()
        )
        return (price, departure) if departure is not None else None

    @staticmethod
    def _combined_offer_supports_selection(
        price: TourCombinedDeparturePrice,
        departure: TourDeparture,
        selection: dict[str, int],
        required_passengers: int,
    ) -> bool:
        fields = {
            "double": "double_price",
            "single": "single_price",
            "extra": "extra_price",
            "childWithBed": "child_with_bed_price",
            "childWithoutBed": "child_without_bed_price",
            "infant": "infant_price",
        }
        return (
            price.departure_id == departure.id
            and price.regular_flight_price is not None
            and is_departure_bookable(departure)
            and all(
                int(count or 0) <= 0 or Decimal(getattr(price, fields[key]) or 0) > 0
                for key, count in selection.items()
                if key in fields
            )
            and (
                departure.capacity_remaining is None
                or departure.capacity_remaining >= required_passengers
            )
        )

    async def reserve_booking_capacity(self, booking: BookingRequest) -> None:
        if booking.capacity_reserved_at is not None:
            return
        for item in booking.items:
            if item.item_type != "tour":
                continue
            if getattr(item, "combined_departure_price_id", None) is not None:
                combined = await self._get_combined_offer_for_update(
                    item.combined_departure_price_id
                )
                required = self._required_passengers(item)
                if combined is None or not self._combined_offer_supports_selection(
                    combined[0], combined[1], item.room_selection or {}, required
                ):
                    raise HotelUnavailableError([])
                departure = combined[1]
                if departure.capacity_remaining is not None:
                    departure.capacity_remaining -= required
                continue
            if item.tour_hotel_price_id is None:
                continue
            offer = await self._get_offer_for_update(item.tour_hotel_price_id)
            required = self._required_rooms(item)
            if offer is None or not self._offer_supports_selection(
                offer, item.room_selection or {}, required
            ):
                alternatives = (
                    [] if offer is None else await self._hotel_alternatives(item, offer)
                )
                raise HotelUnavailableError(alternatives)
            if offer.capacity_remaining is not None:
                offer.capacity_remaining -= required
                offer.is_available = offer.capacity_remaining > 0
        booking.capacity_reserved_at = datetime.now(UTC)
        booking.capacity_released_at = None

    async def release_booking_capacity(self, booking: BookingRequest) -> None:
        """Release a still-active internal hold exactly once."""
        if (
            booking.capacity_reserved_at is None
            or booking.capacity_released_at is not None
        ):
            return
        for item in booking.items:
            if item.item_type != "tour":
                continue
            if getattr(item, "combined_departure_price_id", None) is not None:
                departure = await self.session.scalar(
                    select(TourDeparture)
                    .where(TourDeparture.id == item.tour_departure_id)
                    .with_for_update()
                )
                if departure is not None and departure.capacity_remaining is not None:
                    departure.capacity_remaining = min(
                        departure.capacity_total or 32767,
                        departure.capacity_remaining + self._required_passengers(item),
                    )
                continue
            if item.tour_hotel_price_id is None:
                continue
            offer = await self.session.scalar(
                select(TourDepartureHotelPrice)
                .where(TourDepartureHotelPrice.id == item.tour_hotel_price_id)
                .with_for_update()
            )
            if offer is None or offer.capacity_remaining is None:
                continue
            offer.capacity_remaining = min(
                offer.capacity_total or 32767,
                offer.capacity_remaining + self._required_rooms(item),
            )
            offer.is_available = offer.capacity_remaining > 0
        booking.capacity_released_at = datetime.now(UTC)

    async def delete_expired_booking(self, booking_id: int, admin_id: int) -> bool:
        """Remove an unpaid expired booking and preserve its cart audit trail."""
        booking = await self.get_admin_booking(booking_id, for_update=True)
        if booking is None:
            return False
        if booking.status != "expired":
            raise ValueError("فقط رزروهای منقضی‌شده قابل حذف هستند")

        active_or_settled_payment = await self.session.scalar(
            select(PaymentIntent.id)
            .where(
                PaymentIntent.crm_contract_number == booking.booking_number,
                PaymentIntent.status != PaymentStatus.FAILED,
            )
            .limit(1)
        )
        if active_or_settled_payment is not None:
            raise ValueError("رزرو دارای تراکنش فعال یا سابقهٔ مالی است و نباید حذف شود")

        await self.release_booking_capacity(booking)
        carts = list(
            (
                await self.session.scalars(
                    select(CustomerCart)
                    .where(CustomerCart.converted_booking_id == booking.id)
                    .with_for_update()
                )
            ).all()
        )
        for cart in carts:
            cart.converted_booking_id = None
            cart.status = "expired"
            self.session.add(
                CartEvent(
                    cart_id=cart.id,
                    customer_id=cart.customer_id,
                    actor_type="admin",
                    actor_id=admin_id,
                    event_type="expired_booking_deleted",
                    note="رزرو منقضی‌شده از پنل مدیریت حذف شد.",
                    payload={"bookingNumber": booking.booking_number},
                )
            )
        await self.session.delete(booking)
        await self.session.flush()
        return True

    @staticmethod
    def _offer_supports_selection(
        offer: TourDepartureHotelPrice,
        selection: dict[str, int],
        required_rooms: int | None = None,
    ) -> bool:
        fields = {
            "double": "double_price",
            "single": "single_price",
            "extra": "extra_price",
            "childWithBed": "child_with_bed_price",
            "childWithoutBed": "child_without_bed_price",
            "infant": "infant_price",
        }
        return (
            offer.is_available
            and is_departure_bookable(offer.departure)
            and all(
                int(count or 0) <= 0 or Decimal(getattr(offer, fields[key]) or 0) > 0
                for key, count in selection.items()
                if key in fields
            )
            and (
                offer.capacity_remaining is None
                or offer.capacity_remaining >= (required_rooms or 1)
            )
        )

    async def _hotel_alternatives(
        self, item: CartItem, selected: TourDepartureHotelPrice
    ) -> list[dict[str, Any]]:
        if not is_departure_bookable(selected.departure):
            return []
        offers = list(
            (
                await self.session.scalars(
                    select(TourDepartureHotelPrice)
                    .options(
                        joinedload(TourDepartureHotelPrice.hotel),
                        joinedload(TourDepartureHotelPrice.departure).joinedload(
                            TourDeparture.tour
                        ),
                    )
                    .where(
                        TourDepartureHotelPrice.departure_id == selected.departure_id,
                        TourDepartureHotelPrice.id != selected.id,
                        TourDepartureHotelPrice.is_available.is_(True),
                    )
                )
            )
            .unique()
            .all()
        )
        offers = [
            offer
            for offer in offers
            if self._offer_supports_selection(
                offer, item.room_selection or {}, self._required_rooms(item)
            )
        ]
        selected_price = Decimal(selected.double_price)
        selected_region = (selected.hotel.region or "").strip().casefold()
        offers.sort(
            key=lambda offer: (
                0
                if selected_region
                and (offer.hotel.region or "").strip().casefold() == selected_region
                else 1,
                abs(offer.hotel.star_rating - selected.hotel.star_rating),
                abs(Decimal(offer.double_price) - selected_price),
            )
        )
        return [
            {
                "offerId": offer.id,
                "hotelId": offer.hotel.id,
                "hotelName": offer.hotel.name,
                "hotelSlug": offer.hotel.slug,
                "tourSlug": offer.departure.tour.slug,
                "stars": offer.hotel.star_rating,
                "region": offer.hotel.region,
                "roomType": offer.room_type,
                "serviceType": offer.service_type,
                "price": str(offer.double_price),
                "currency": getattr(offer, "double_currency", None)
                or offer.package_currency,
            }
            for offer in offers[:4]
        ]

    async def _validate_tour_hotels(self, cart: list[CartItem]) -> None:
        for item in cart:
            if item.item_type != "tour":
                continue
            if getattr(item, "combined_departure_price_id", None) is not None:
                combined = await self._get_combined_offer_for_update(
                    item.combined_departure_price_id
                )
                if combined is None or not self._combined_offer_supports_selection(
                    combined[0],
                    combined[1],
                    item.room_selection or {},
                    self._required_passengers(item),
                ):
                    raise HotelUnavailableError([])
                continue
            if item.tour_hotel_price_id is None:
                continue
            selected = await self._get_offer_for_update(item.tour_hotel_price_id)
            if selected is None or not self._offer_supports_selection(
                selected, item.room_selection or {}, self._required_rooms(item)
            ):
                alternatives = (
                    []
                    if selected is None
                    else await self._hotel_alternatives(item, selected)
                )
                raise HotelUnavailableError(alternatives)

    async def create_from_cart(
        self,
        customer_id: int,
        customer_note: str | None,
        passenger_details: list[dict[str, Any]] | None = None,
        payment_method: str = "cash",
        terms_accepted: bool = False,
        terms_version: str = "checkout-1405-01",
        discount_code: str | None = None,
        direct_cart_id: int | None = None,
    ) -> BookingRequest:
        cart_record = await self.session.scalar(
            select(CustomerCart)
            .where(
                CustomerCart.customer_id == customer_id,
                (
                    CustomerCart.id == direct_cart_id
                    if direct_cart_id is not None
                    else CustomerCart.status == "active"
                ),
            )
            .with_for_update()
        )
        if cart_record is None:
            raise ValueError("cart is empty")
        cart = list(
            (
                await self.session.scalars(
                    select(CartItem)
                    .where(CartItem.cart_id == cart_record.id)
                    .with_for_update()
                )
            ).all()
        )
        if not terms_accepted:
            raise ValueError("پذیرش قوانین خرید الزامی است")
        cart = [item for item in cart if item.status != "cancelled"]
        if not cart:
            raise ValueError("cart is empty")
        blocked_items = [item for item in cart if item.status != "active"]
        if blocked_items:
            raise ValueError(
                "قیمت یا ظرفیت برخی خدمات تغییر کرده است؛ ابتدا سبد را "
                "به‌روزرسانی و تغییرات را تأیید کنید."
            )
        await self._validate_tour_hotels(cart)
        passenger_details = passenger_details or []
        if not passenger_details:
            raise ValueError("passenger details are required before creating a booking")
        settings = await self.session.get(SiteSetting, 1)
        rates = exchange_rates_from_links(settings.social_links if settings else {})
        item_totals = [item_total_to_toman(item, rates) for item in cart]
        directly_quotable = all(
            amount is not None and amount > 0 for amount in item_totals
        )
        currency = "IRT"
        total = (
            sum((amount or Decimal(0) for amount in item_totals), Decimal(0))
            if directly_quotable
            else None
        )
        discount_amount = Decimal(0)
        normalized_discount_code: str | None = None
        if discount_code:
            normalized_discount_code = discount_code.strip().upper()
            code = await self.session.scalar(
                select(DiscountCode)
                .where(DiscountCode.code == normalized_discount_code)
                .with_for_update()
            )
            now = datetime.now(UTC)
            if code is None or not code.is_active:
                raise ValueError("discount code is not valid")
            if (code.starts_at and code.starts_at > now) or (
                code.ends_at and code.ends_at < now
            ):
                raise ValueError("discount code is not active at this time")
            if code.max_uses is not None and code.used_count >= code.max_uses:
                raise ValueError("discount code usage limit has been reached")
            if total is None:
                raise ValueError("discount requires a final toman total")
            if (
                code.minimum_order_amount is not None
                and total < code.minimum_order_amount
            ):
                raise ValueError("order does not meet the discount minimum")
            raw_discount = (
                total * code.amount / Decimal(100)
                if code.discount_type == "percentage"
                else code.amount
            )
            discount_amount = min(raw_discount, total)
            code.used_count += 1
            total -= discount_amount
        hold_expires_at = datetime.now(UTC) + timedelta(minutes=30)
        booking = BookingRequest(
            booking_number=f"JB-{token_hex(6).upper()}",
            customer_id=customer_id,
            total_amount=total,
            currency=currency,
            exchange_rates_snapshot={code: str(rate) for code, rate in rates.items()},
            payment_method=payment_method,
            checkout_step="review",
            payment_expires_at=hold_expires_at,
            terms_version=terms_version,
            terms_accepted_at=datetime.now(UTC),
            subtotal_amount=(total + discount_amount) if total is not None else None,
            discount_amount=discount_amount,
            discount_code=normalized_discount_code,
            payable_now_amount=total if payment_method == "cash" else None,
            installment_status="draft" if payment_method == "installment" else None,
            passenger_details=passenger_details,
            customer_note=(
                customer_note.strip()
                if customer_note and customer_note.strip()
                else None
            ),
        )
        self.session.add(booking)
        await self.session.flush()
        if payment_method == "agency_credit":
            if total is None:
                raise ValueError("خرید اعتباری آژانس نیازمند مبلغ نهایی تومانی است")
            await AgencyRepository(self.session).reserve_for_booking(booking, total)
        for item in cart:
            self.session.add(
                BookingItem(
                    booking_id=booking.id,
                    item_type=item.item_type,
                    source_cart_item_id=item.id,
                    tour_id=item.tour_id,
                    travel_service_id=item.travel_service_id,
                    tour_departure_id=item.tour_departure_id,
                    hotel_package_id=item.hotel_package_id,
                    tour_hotel_price_id=item.tour_hotel_price_id,
                    combined_departure_price_id=getattr(
                        item, "combined_departure_price_id", None
                    ),
                    room_selection=item.room_selection,
                    title_snapshot=item.title_snapshot,
                    details_snapshot=item.details_snapshot,
                    price_amount=item.price_amount,
                    currency=item.currency,
                    hotel_amount=item.hotel_amount,
                    hotel_currency=item.hotel_currency,
                    flight_amount=item.flight_amount,
                    flight_currency=item.flight_currency,
                )
            )
        booking = await self.session.scalar(
            select(BookingRequest)
            .options(*self._options())
            .where(BookingRequest.id == booking.id)
        )
        if booking is None:
            raise RuntimeError("booking could not be reloaded for capacity hold")
        await self.reserve_booking_capacity(booking)

        cart_record.status = "converted"
        cart_record.converted_booking_id = booking.id
        cart_record.last_activity_at = datetime.now(UTC)
        for item in cart:
            item.status = "converted"
        self.session.add(
            CartEvent(
                cart_id=cart_record.id,
                customer_id=customer_id,
                actor_type="customer",
                actor_id=customer_id,
                event_type="cart_converted_to_booking_request",
                note="Booking request created from cart snapshot.",
                payload={
                    "bookingId": booking.id,
                    "bookingNumber": booking.booking_number,
                },
            )
        )
        await self.session.flush()
        self.session.add(
            BookingStatusEvent(
                booking_id=booking.id,
                actor_type="customer",
                actor_id=customer_id,
                event_type="booking_created",
                from_status=None,
                to_status="pending_review",
                note=None,
                payload={
                    "paymentMethod": payment_method,
                    "discountCode": normalized_discount_code,
                },
            )
        )
        return booking

    async def list_customer_bookings(self, customer_id: int) -> list[BookingRequest]:
        await self.expire_overdue_invoices()
        query = (
            select(BookingRequest)
            .options(*self._options())
            .where(
                BookingRequest.customer_id == customer_id,
                BookingRequest.customer_hidden_at.is_(None),
            )
            .order_by(BookingRequest.created_at.desc(), BookingRequest.id.desc())
        )
        return list((await self.session.scalars(query)).unique().all())

    async def archive_customer_booking(self, customer_id: int, booking_id: int) -> bool:
        """Hide a booking from its owner's account history.

        The booking stays available to support, payment, and accounting systems.
        """
        booking = await self.session.scalar(
            select(BookingRequest)
            .where(
                BookingRequest.id == booking_id,
                BookingRequest.customer_id == customer_id,
                BookingRequest.customer_hidden_at.is_(None),
            )
            .with_for_update()
        )
        if booking is None:
            return False
        booking.customer_hidden_at = datetime.now(UTC)
        self.session.add(
            BookingStatusEvent(
                booking_id=booking.id,
                actor_type="customer",
                actor_id=customer_id,
                event_type="customer_history_archived",
                from_status=booking.status,
                to_status=booking.status,
                note="Customer hid a booking from account history.",
                payload={},
            )
        )
        await self.session.flush()
        return True

    async def get_customer_booking(
        self, customer_id: int, booking_id: int
    ) -> BookingRequest | None:
        await self.expire_overdue_invoices()
        return await self.session.scalar(
            select(BookingRequest)
            .options(*self._options())
            .where(
                BookingRequest.id == booking_id,
                BookingRequest.customer_id == customer_id,
                BookingRequest.customer_hidden_at.is_(None),
            )
        )

    async def list_admin_bookings(
        self, status: str | None = None
    ) -> list[BookingRequest]:
        await self.expire_overdue_invoices()
        query = select(BookingRequest).options(*self._options())
        if status:
            query = query.where(BookingRequest.status == status)
        else:
            # Keep rejected requests in the database for customer history and
            # audit events, but leave them out of the default support queue.
            # An explicit ?status=rejected query can still be used for history.
            query = query.where(BookingRequest.status != "rejected")
        query = query.order_by(
            BookingRequest.created_at.desc(), BookingRequest.id.desc()
        ).limit(200)
        return list((await self.session.scalars(query)).unique().all())

    async def get_admin_booking(
        self, booking_id: int, *, for_update: bool = False
    ) -> BookingRequest | None:
        await self.expire_overdue_invoices()
        if for_update:
            locked_id = await self.session.scalar(
                select(BookingRequest.id)
                .where(BookingRequest.id == booking_id)
                .with_for_update()
            )
            if locked_id is None:
                return None
        query = (
            select(BookingRequest)
            .options(*self._options())
            .where(BookingRequest.id == booking_id)
        )
        return await self.session.scalar(query)
