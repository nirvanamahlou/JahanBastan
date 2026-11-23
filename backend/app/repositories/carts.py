"""Lifecycle, audit, and price-validation persistence for recoverable travel carts."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import (
    BookingRequest,
    CartEvent,
    CartItem,
    CustomerCart,
    CustomerUser,
    PaymentIntent,
    SiteSetting,
    TourDepartureHotelPrice,
    TourHotelPackage,
)
from app.repositories.customer_commerce import CustomerCommerceRepository
from app.services.currency import exchange_rates_from_links, item_total_to_toman

ACTIVE_ITEM_STATUSES = (
    "active",
    "price_changed",
    "availability_check_required",
    "unavailable",
    "expired",
)


class CartLifecycleRepository:
    """Keep active carts recoverable and preserve every commercial state change."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _item_options() -> tuple[Any, ...]:
        return (
            joinedload(CartItem.tour),
            joinedload(CartItem.travel_service),
            joinedload(CartItem.tour_departure),
            joinedload(CartItem.hotel_package).joinedload(TourHotelPackage.hotel),
            joinedload(CartItem.tour_hotel_price).joinedload(
                TourDepartureHotelPrice.hotel
            ),
        )

    async def _mark_abandoned(self) -> None:
        now = datetime.now(UTC)
        abandoned_cutoff = now - timedelta(days=1)
        expired_cutoff = now - timedelta(days=30)
        active_carts = list(
            (
                await self.session.scalars(
                    select(CustomerCart).where(
                        CustomerCart.status == "active",
                        CustomerCart.last_activity_at < abandoned_cutoff,
                    )
                )
            ).all()
        )
        for cart in active_carts:
            cart.status = "abandoned"
            self._event(
                cart,
                "system",
                "cart_abandoned",
                note="No customer activity for 24 hours.",
            )
        expired_carts = list(
            (
                await self.session.scalars(
                    select(CustomerCart).where(
                        CustomerCart.status == "abandoned",
                        CustomerCart.last_activity_at < expired_cutoff,
                    )
                )
            ).all()
        )
        for cart in expired_carts:
            cart.status = "expired"
            self._event(cart, "system", "cart_expired", note="Cart retained for audit.")

    async def get_or_create_active(self, customer_id: int) -> CustomerCart:
        await self._mark_abandoned()
        cart = await self.session.scalar(
            select(CustomerCart)
            .where(
                CustomerCart.customer_id == customer_id,
                CustomerCart.status == "active",
            )
            .with_for_update()
        )
        if cart is None:
            now = datetime.now(UTC)
            cart = CustomerCart(
                customer_id=customer_id,
                status="active",
                currency="IRT",
                expires_at=now + timedelta(hours=2),
                last_activity_at=now,
            )
            self.session.add(cart)
            await self.session.flush()
            self._event(cart, "customer", "cart_created")
        return cart

    def _event(
        self,
        cart: CustomerCart,
        actor_type: str,
        event_type: str,
        *,
        item_id: int | None = None,
        actor_id: int | None = None,
        note: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        self.session.add(
            CartEvent(
                cart_id=cart.id,
                cart_item_id=item_id,
                customer_id=cart.customer_id,
                actor_type=actor_type,
                actor_id=actor_id,
                event_type=event_type,
                note=note,
                payload=payload or {},
            )
        )

    async def _sync_totals(self, cart: CustomerCart, items: list[CartItem]) -> None:
        settings = await self.session.get(SiteSetting, 1)
        rates = exchange_rates_from_links(settings.social_links if settings else {})
        totals = [item_total_to_toman(item, rates) for item in items]
        if totals and all(value is not None and value > 0 for value in totals):
            cart.subtotal_amount = sum(
                (value or Decimal(0) for value in totals), Decimal(0)
            )
            cart.total_amount = cart.subtotal_amount - cart.discount_amount
        else:
            cart.subtotal_amount = None
            cart.total_amount = None

    async def get_items(self, customer_id: int) -> list[CartItem]:
        cart = await self.session.scalar(
            select(CustomerCart).where(
                CustomerCart.customer_id == customer_id,
                CustomerCart.status == "active",
            )
        )
        if cart is None:
            return []
        now = datetime.now(UTC)
        statement = (
            select(CartItem)
            .options(*self._item_options())
            .where(
                CartItem.cart_id == cart.id,
                CartItem.status.in_(ACTIVE_ITEM_STATUSES),
            )
            .order_by(CartItem.updated_at.desc(), CartItem.id.desc())
        )
        items = list((await self.session.scalars(statement)).unique().all())
        if cart.expires_at and cart.expires_at <= now:
            for item in items:
                if item.status == "active":
                    item.status = "availability_check_required"
        return items

    async def get_summary(self, customer_id: int) -> CustomerCart | None:
        cart = await self.session.scalar(
            select(CustomerCart)
            .options(
                selectinload(CustomerCart.items),
                selectinload(CustomerCart.events),
            )
            .where(
                CustomerCart.customer_id == customer_id,
                CustomerCart.status == "active",
            )
        )
        if cart is None:
            return None
        active_items = [
            item for item in cart.items if item.status in ACTIVE_ITEM_STATUSES
        ]
        await self._sync_totals(cart, active_items)
        return cart

    async def add_item(
        self,
        customer_id: int,
        *,
        item_type: str,
        tour_id: int | None,
        tour_departure_id: int | None,
        tour_hotel_price_id: int | None,
        combined_departure_price_id: int | None,
        room_selection: dict[str, int],
        travel_service_id: int | None,
    ) -> CartItem | None:
        cart = await self.get_or_create_active(customer_id)
        commerce = CustomerCommerceRepository(self.session)
        item = (
            await commerce.add_combined_tour(
                customer_id,
                tour_id or 0,
                tour_departure_id or 0,
                combined_departure_price_id,
                room_selection,
                cart_id=cart.id,
            )
            if item_type == "tour" and combined_departure_price_id is not None
            else await commerce.add_tour(
                customer_id,
                tour_id or 0,
                tour_departure_id or 0,
                tour_hotel_price_id or 0,
                room_selection,
                cart_id=cart.id,
            )
            if item_type == "tour"
            else await commerce.add_transport(
                customer_id,
                travel_service_id or 0,
                item_type,
                cart_id=cart.id,
            )
        )
        if item is None:
            return None
        now = datetime.now(UTC)
        item.status = "active"
        item.price_checked_at = now
        item.expires_at = now + timedelta(hours=2)
        cart.expires_at = item.expires_at
        cart.last_activity_at = now
        self._event(
            cart,
            "customer",
            "cart_item_added",
            item_id=item.id,
            payload={"itemType": item.item_type, "title": item.title_snapshot},
        )
        items = await self.get_items(customer_id)
        await self._sync_totals(cart, items)
        await self.session.flush()
        return item

    @staticmethod
    def _price_fields(item: CartItem) -> tuple[Any, ...]:
        return (
            item.price_amount,
            item.currency,
            item.hotel_amount,
            item.hotel_currency,
            item.flight_amount,
            item.flight_currency,
        )

    async def refresh(self, customer_id: int) -> list[CartItem]:
        cart = await self.get_or_create_active(customer_id)
        items = await self.get_items(customer_id)
        commerce = CustomerCommerceRepository(self.session)
        now = datetime.now(UTC)
        for item in items:
            before = self._price_fields(item)
            refreshed = (
                await commerce.add_combined_tour(
                    customer_id,
                    item.tour_id or 0,
                    item.tour_departure_id or 0,
                    item.combined_departure_price_id,
                    item.room_selection or {},
                    cart_id=cart.id,
                )
                if item.item_type == "tour"
                and item.combined_departure_price_id is not None
                else await commerce.add_tour(
                    customer_id,
                    item.tour_id or 0,
                    item.tour_departure_id or 0,
                    item.tour_hotel_price_id or 0,
                    item.room_selection or {},
                    cart_id=cart.id,
                )
                if item.item_type == "tour"
                else await commerce.add_transport(
                    customer_id,
                    item.travel_service_id or 0,
                    item.item_type,
                    cart_id=cart.id,
                )
            )
            if refreshed is None:
                item.status = "unavailable"
                item.price_checked_at = now
                item.expires_at = now + timedelta(hours=2)
                self._event(cart, "system", "item_unavailable", item_id=item.id)
                continue
            current = self._price_fields(item)
            item.current_price_amount = item.price_amount
            item.current_currency = item.currency
            item.current_hotel_amount = item.hotel_amount
            item.current_hotel_currency = item.hotel_currency
            item.current_flight_amount = item.flight_amount
            item.current_flight_currency = item.flight_currency
            item.price_checked_at = now
            item.expires_at = now + timedelta(hours=2)
            if current != before:
                (
                    item.price_amount,
                    item.currency,
                    item.hotel_amount,
                    item.hotel_currency,
                    item.flight_amount,
                    item.flight_currency,
                ) = before
                item.status = "price_changed"
                self._event(
                    cart,
                    "system",
                    "price_changed",
                    item_id=item.id,
                    payload={
                        "previous": [
                            str(value) if value is not None else None
                            for value in before
                        ],
                        "current": [
                            str(value) if value is not None else None
                            for value in current
                        ],
                    },
                )
            else:
                item.status = "active"
                self._event(cart, "system", "price_verified", item_id=item.id)
        cart.expires_at = now + timedelta(hours=2)
        cart.last_activity_at = now
        await self._sync_totals(cart, items)
        await self.session.flush()
        return await self.get_items(customer_id)

    async def accept_price_changes(
        self, customer_id: int, item_ids: list[int] | None
    ) -> list[CartItem]:
        cart = await self.get_or_create_active(customer_id)
        items = await self.get_items(customer_id)
        eligible = [
            item
            for item in items
            if item.status == "price_changed" and (not item_ids or item.id in item_ids)
        ]
        for item in eligible:
            item.price_amount = item.current_price_amount
            item.currency = item.current_currency
            item.hotel_amount = item.current_hotel_amount
            item.hotel_currency = item.current_hotel_currency
            item.flight_amount = item.current_flight_amount
            item.flight_currency = item.current_flight_currency
            item.status = "active"
            self._event(cart, "customer", "price_change_accepted", item_id=item.id)
        cart.last_activity_at = datetime.now(UTC)
        await self._sync_totals(cart, items)
        await self.session.flush()
        return items

    async def remove_item(self, customer_id: int, item_id: int) -> bool:
        cart = await self.session.scalar(
            select(CustomerCart).where(
                CustomerCart.customer_id == customer_id,
                CustomerCart.status == "active",
            )
        )
        if cart is None:
            return False
        item = await self.session.scalar(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        if item is None or item.status == "cancelled":
            return False
        item.status = "cancelled"
        cart.last_activity_at = datetime.now(UTC)
        self._event(cart, "customer", "cart_item_removed", item_id=item.id)
        remaining = await self.session.scalar(
            select(CartItem.id)
            .where(
                CartItem.cart_id == cart.id,
                CartItem.status.in_(ACTIVE_ITEM_STATUSES),
            )
            .limit(1)
        )
        if remaining is None:
            cart.status = "cancelled"
            self._event(cart, "customer", "cart_cancelled")
        await self.session.flush()
        return True

    async def request_consultation(self, customer_id: int, message: str | None) -> None:
        cart = await self.get_or_create_active(customer_id)
        summary = "درخواست مشاوره برای سبد خرید"
        note = (
            message or ""
        ).strip() or "لطفاً برای بررسی قیمت و ظرفیت این سبد با من تماس بگیرید."
        await CustomerCommerceRepository(self.session).create_support_request(
            customer_id, summary, note
        )
        cart.last_activity_at = datetime.now(UTC)
        self._event(cart, "customer", "consultation_requested", note=note)
        await self.session.flush()

    @staticmethod
    def _masked_identifier(value: object) -> str | None:
        text = str(value or "").strip()
        if not text:
            return None
        return f"••••{text[-4:]}" if len(text) > 4 else "••••"

    @staticmethod
    def _passenger_value(payload: dict[str, Any], key: str) -> Any:
        camel = "".join(
            part.capitalize() if index else part
            for index, part in enumerate(key.split("_"))
        )
        return payload.get(key, payload.get(camel))

    @staticmethod
    def _payment_status(payment: PaymentIntent) -> str:
        return str(getattr(payment.status, "value", payment.status))

    def _safe_passengers(self, booking: BookingRequest) -> list[dict[str, Any]]:
        passengers: list[dict[str, Any]] = []
        for entry in booking.passenger_details or []:
            if not isinstance(entry, dict):
                continue
            first_name = self._passenger_value(entry, "first_name")
            last_name = self._passenger_value(entry, "last_name")
            full_name = self._passenger_value(entry, "full_name") or " ".join(
                value for value in (first_name, last_name) if value
            )
            national_code = self._passenger_value(entry, "national_code")
            passport_number = self._passenger_value(entry, "passport_number")
            passengers.append(
                {
                    "full_name": str(full_name or "مسافر ثبت‌نشده"),
                    "passenger_type": str(
                        self._passenger_value(entry, "passenger_type") or "adult"
                    ),
                    "age": self._passenger_value(entry, "age"),
                    "national_code_masked": self._masked_identifier(national_code),
                    "passport_number_masked": self._masked_identifier(passport_number),
                    "documents_complete": bool(
                        full_name and (national_code or passport_number)
                    ),
                }
            )
        return passengers

    def _payment_payload(self, payment: PaymentIntent) -> dict[str, Any]:
        return {
            "id": payment.id,
            "amount": payment.amount,
            "currency": payment.currency,
            "status": self._payment_status(payment),
            "provider": payment.provider,
            "provider_reference": payment.provider_reference,
            "verified_at": payment.verified_at,
            "failure_reason": payment.failure_reason,
            "refunded_amount": payment.refunded_amount,
            "created_at": payment.created_at,
        }

    def _admin_payload(
        self,
        cart: CustomerCart,
        booking: BookingRequest | None,
        payments: list[PaymentIntent],
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        safe_passengers = self._safe_passengers(booking) if booking else []
        booking_payload: dict[str, Any] | None = None
        if booking is not None:
            booking_payload = {
                "id": booking.id,
                "booking_number": booking.booking_number,
                "status": booking.status,
                "currency": booking.currency,
                "subtotal_amount": booking.subtotal_amount,
                "discount_amount": booking.discount_amount,
                "discount_code": booking.discount_code,
                "tax_amount": booking.tax_amount,
                "service_fee_amount": booking.service_fee_amount,
                "total_amount": booking.total_amount,
                "payable_now_amount": booking.payable_now_amount,
                "payment_method": booking.payment_method,
                "payment_expires_at": booking.payment_expires_at,
                "paid_at": booking.paid_at,
                "capacity_reserved_at": booking.capacity_reserved_at,
                "capacity_released_at": booking.capacity_released_at,
                "customer_note": booking.customer_note,
                "admin_note": booking.admin_note,
                "passengers": safe_passengers,
                "documents_pending": sum(
                    not passenger["documents_complete"] for passenger in safe_passengers
                ),
            }

        destinations: list[str] = []
        travel_dates = []
        capacity_summary: list[str] = []
        alerts: list[str] = []
        for item in cart.items:
            service = item.travel_service
            departure = item.tour_departure
            hotel_price = item.tour_hotel_price
            destination = (
                service.destination_name
                if service is not None and service.destination_name
                else item.title_snapshot
            )
            if destination not in destinations:
                destinations.append(destination)
            travel_date = (
                service.departure_date
                if service is not None
                else departure.departure_date
                if departure is not None
                else None
            )
            if travel_date is not None and travel_date not in travel_dates:
                travel_dates.append(travel_date)
            if service is not None and service.available_seats is not None:
                capacity_summary.append(
                    f"{item.title_snapshot}: {service.available_seats} صندلی باقی‌مانده"
                )
            elif hotel_price is not None and hotel_price.capacity_remaining is not None:
                capacity_summary.append(
                    f"{item.title_snapshot}: "
                    f"{hotel_price.capacity_remaining} ظرفیت باقی‌مانده"
                )
            if item.status == "price_changed":
                alerts.append(f"تغییر قیمت: {item.title_snapshot}")
            elif item.status in {"unavailable", "availability_check_required"}:
                alerts.append(f"ظرفیت نیازمند بررسی: {item.title_snapshot}")

        payment_rows = [self._payment_payload(payment) for payment in payments]
        paid_statuses = {
            "paid",
            "crm_sync_pending",
            "crm_synced",
            "partially_refunded",
        }
        paid_amount = sum(
            (
                payment.amount
                for payment in payments
                if self._payment_status(payment) in paid_statuses
            ),
            Decimal(0),
        )
        total = booking.total_amount if booking else cart.total_amount
        remaining_amount = (
            max(Decimal(0), total - paid_amount) if total is not None else None
        )
        payment_failed = any(
            self._payment_status(payment) == "failed" for payment in payments
        )
        if payment_failed:
            alerts.append(
                "پرداخت ناموفق است؛ امکان ارسال دوباره یادآوری پرداخت وجود دارد."
            )
        if booking_payload and booking_payload["documents_pending"]:
            alerts.append("اطلاعات هویتی یک یا چند مسافر ناقص است.")
        if (
            cart.status in {"active", "abandoned"}
            and cart.expires_at is not None
            and now <= cart.expires_at <= now + timedelta(minutes=30)
        ):
            alerts.append("زمان نگه‌داری موقت سبد رو به پایان است.")
        if cart.status == "abandoned":
            alerts.append("سبد رهاشده است؛ یادآوری یا پیشنهاد تخفیف را بررسی کنید.")

        operational_status = cart.status
        if booking is not None:
            if booking.status == "approved":
                operational_status = (
                    "payment_failed" if payment_failed else "awaiting_payment"
                )
            elif booking.status == "paid":
                operational_status = "converted"
            elif booking.status in {"expired", "cancelled"}:
                operational_status = booking.status

        return {
            "id": cart.id,
            "status": cart.status,
            "currency": cart.currency,
            "subtotal_amount": cart.subtotal_amount,
            "discount_amount": cart.discount_amount,
            "total_amount": cart.total_amount,
            "expires_at": cart.expires_at,
            "last_activity_at": cart.last_activity_at,
            "converted_booking_id": cart.converted_booking_id,
            "assigned_admin_id": cart.assigned_admin_id,
            "created_at": cart.created_at,
            "updated_at": cart.updated_at,
            "items": cart.items,
            "events": cart.events,
            "customer": cart.customer,
            "operational_status": operational_status,
            "booking": booking_payload,
            "payments": payment_rows,
            "paid_amount": paid_amount,
            "remaining_amount": remaining_amount,
            "destinations": destinations,
            "travel_dates": sorted(travel_dates),
            "capacity_summary": capacity_summary,
            "alerts": alerts,
        }

    async def list_for_admin(
        self,
        status: str | None,
        *,
        query: str | None = None,
        item_type: str | None = None,
        amount_from: Decimal | None = None,
        amount_to: Decimal | None = None,
    ) -> list[dict[str, Any]]:
        await self._mark_abandoned()
        statement = (
            select(CustomerCart)
            .options(
                joinedload(CustomerCart.customer),
                selectinload(CustomerCart.items).joinedload(CartItem.travel_service),
                selectinload(CustomerCart.items).joinedload(CartItem.tour_departure),
                selectinload(CustomerCart.items).joinedload(CartItem.tour_hotel_price),
                selectinload(CustomerCart.events),
            )
            .where(CustomerCart.admin_hidden_at.is_(None))
            .order_by(CustomerCart.updated_at.desc(), CustomerCart.id.desc())
            .limit(200)
        )
        if status:
            statement = statement.where(CustomerCart.status == status)
        if item_type:
            statement = statement.where(
                CustomerCart.items.any(CartItem.item_type == item_type)
            )
        if amount_from is not None:
            statement = statement.where(CustomerCart.total_amount >= amount_from)
        if amount_to is not None:
            statement = statement.where(CustomerCart.total_amount <= amount_to)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    CustomerCart.customer.has(
                        or_(
                            CustomerUser.full_name.ilike(pattern),
                            CustomerUser.email.ilike(pattern),
                            CustomerUser.phone.ilike(pattern),
                        )
                    ),
                    CustomerCart.items.any(
                        or_(
                            CartItem.title_snapshot.ilike(pattern),
                            CartItem.details_snapshot.ilike(pattern),
                        )
                    ),
                )
            )
        carts = list((await self.session.scalars(statement)).unique().all())
        booking_ids = [
            cart.converted_booking_id for cart in carts if cart.converted_booking_id
        ]
        bookings = (
            list(
                (
                    await self.session.scalars(
                        select(BookingRequest).where(BookingRequest.id.in_(booking_ids))
                    )
                ).all()
            )
            if booking_ids
            else []
        )
        bookings_by_id = {booking.id: booking for booking in bookings}
        booking_numbers = [booking.booking_number for booking in bookings]
        payments = (
            list(
                (
                    await self.session.scalars(
                        select(PaymentIntent)
                        .where(PaymentIntent.crm_contract_number.in_(booking_numbers))
                        .order_by(
                            PaymentIntent.created_at.desc(), PaymentIntent.id.desc()
                        )
                    )
                ).all()
            )
            if booking_numbers
            else []
        )
        payments_by_booking: dict[str, list[PaymentIntent]] = {}
        for payment in payments:
            payments_by_booking.setdefault(payment.crm_contract_number, []).append(
                payment
            )
        rows: list[dict[str, Any]] = []
        for cart in carts:
            booking = bookings_by_id.get(cart.converted_booking_id)
            rows.append(
                self._admin_payload(
                    cart,
                    booking,
                    payments_by_booking.get(booking.booking_number, [])
                    if booking is not None
                    else [],
                )
            )
        return rows

    async def archive_for_admin(
        self, cart_id: int, admin_id: int
    ) -> CustomerCart | None:
        """Remove a cart from the operations list while retaining its audit history."""
        cart = await self.session.scalar(
            select(CustomerCart)
            .where(
                CustomerCart.id == cart_id,
                CustomerCart.admin_hidden_at.is_(None),
            )
            .with_for_update()
        )
        if cart is None:
            return None
        cart.admin_hidden_at = datetime.now(UTC)
        self._event(
            cart,
            "admin",
            "cart_archived_from_admin_list",
            actor_id=admin_id,
            note="Cart hidden from the administrative operations list.",
        )
        await self.session.flush()
        return cart

    async def add_admin_follow_up(
        self, cart_id: int, admin_id: int, note: str
    ) -> CustomerCart | None:
        cart = await self.session.scalar(
            select(CustomerCart).where(CustomerCart.id == cart_id)
        )
        if cart is None:
            return None
        cart.assigned_admin_id = admin_id
        self._event(
            cart,
            "admin",
            "follow_up_logged",
            actor_id=admin_id,
            note=note.strip() or "پیگیری سبد",
        )
        await self.session.flush()
        return cart

    async def extend_admin_hold(
        self, cart_id: int, admin_id: int, minutes: int
    ) -> CustomerCart | None:
        cart = await self.session.scalar(
            select(CustomerCart).where(CustomerCart.id == cart_id).with_for_update()
        )
        if cart is None:
            return None
        if cart.status in {"converted", "expired", "cancelled"}:
            raise ValueError("این سبد در وضعیت فعلی قابل تمدید نیست")
        now = datetime.now(UTC)
        cart.status = "active"
        cart.expires_at = now + timedelta(minutes=minutes)
        cart.last_activity_at = now
        self._event(
            cart,
            "admin",
            "cart_hold_extended",
            actor_id=admin_id,
            note=f"نگه‌داری موقت به مدت {minutes} دقیقه تمدید شد.",
            payload={"minutes": minutes},
        )
        await self.session.flush()
        return cart

    async def cancel_admin_cart(
        self, cart_id: int, admin_id: int
    ) -> CustomerCart | None:
        cart = await self.session.scalar(
            select(CustomerCart)
            .options(selectinload(CustomerCart.items))
            .where(CustomerCart.id == cart_id)
            .with_for_update()
        )
        if cart is None:
            return None
        if cart.status == "converted":
            raise ValueError("رزرو تبدیل‌شده باید از بخش درخواست‌های رزرو لغو شود")
        if cart.status == "cancelled":
            return cart
        for item in cart.items:
            if item.status in ACTIVE_ITEM_STATUSES:
                item.status = "cancelled"
        cart.status = "cancelled"
        cart.last_activity_at = datetime.now(UTC)
        self._event(cart, "admin", "cart_cancelled", actor_id=admin_id)
        await self.session.flush()
        return cart

    async def send_admin_reminder(
        self, cart_id: int, admin_id: int, message: str | None
    ) -> CustomerCart | None:
        cart = await self.session.scalar(
            select(CustomerCart).where(CustomerCart.id == cart_id).with_for_update()
        )
        if cart is None:
            return None
        booking = (
            await self.session.get(BookingRequest, cart.converted_booking_id)
            if cart.converted_booking_id
            else None
        )
        default_message = (
            "برای تکمیل پرداخت و مشاهده جزئیات رزرو، لطفاً وارد حساب کاربری شوید."
            if booking is not None
            else "سبد سفر شما ذخیره شده است؛ برای تکمیل خرید وارد سبد خرید شوید."
        )
        body = (message or "").strip() or default_message
        from app.repositories.operations import OperationsRepository

        await OperationsRepository(self.session).create_notification(
            cart.customer_id,
            notification_type="booking" if booking is not None else "account",
            title="یادآوری تکمیل خرید",
            body=body,
            link="/account/operations/" if booking is not None else "/cart/",
        )
        self._event(
            cart,
            "admin",
            "payment_link_resent" if booking is not None else "cart_reminder_sent",
            actor_id=admin_id,
            note=body,
        )
        await self.session.flush()
        return cart
