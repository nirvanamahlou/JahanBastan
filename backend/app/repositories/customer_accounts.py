"""Database access for public customer accounts and sessions."""

from datetime import UTC, date, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import (
    AvailabilityAlert,
    BookingRequest,
    CustomerPassenger,
    CustomerPasswordResetToken,
    CustomerSession,
    CustomerSmsLoginCode,
    CustomerSupportRequest,
    CustomerUser,
    PaymentIntent,
    VisaApplication,
)
from app.models.checkout import BookingDocument


class CustomerUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> CustomerUser | None:
        statement = select(CustomerUser).where(
            func.lower(CustomerUser.email) == email.lower()
        )
        return await self.session.scalar(statement)

    async def get_by_id(self, user_id: int) -> CustomerUser | None:
        return await self.session.get(CustomerUser, user_id)

    async def get_by_phone(self, phone: str) -> CustomerUser | None:
        return await self.session.scalar(
            select(CustomerUser).where(CustomerUser.phone == phone)
        )

    async def list_for_admin(
        self,
        *,
        query: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[CustomerUser], int]:
        """Return a bounded customer page for privileged support staff."""
        filters = [
            CustomerUser.admin_hidden_at.is_(None),
        ]
        if query and (normalized := query.strip()):
            match = f"%{normalized}%"
            filters.append(
                or_(
                    CustomerUser.full_name.ilike(match),
                    CustomerUser.email.ilike(match),
                    CustomerUser.phone.ilike(match),
                )
            )

        statement = select(CustomerUser)
        count_statement = select(func.count(CustomerUser.id))
        if filters:
            statement = statement.where(*filters)
            count_statement = count_statement.where(*filters)
        statement = (
            statement.order_by(
                CustomerUser.created_at.desc(),
                CustomerUser.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        users = list((await self.session.scalars(statement)).all())
        total = int(await self.session.scalar(count_statement) or 0)
        return users, total

    @staticmethod
    def _passenger_name(
        passengers: list[dict[str, object]] | None, passenger_index: int | None
    ) -> str | None:
        if (
            passenger_index is None
            or not passengers
            or passenger_index >= len(passengers)
        ):
            return None
        passenger = passengers[passenger_index]
        if not isinstance(passenger, dict):
            return None
        first_name = str(
            passenger.get("firstName") or passenger.get("first_name") or ""
        ).strip()
        last_name = str(
            passenger.get("lastName") or passenger.get("last_name") or ""
        ).strip()
        full_name = " ".join(part for part in (first_name, last_name) if part)
        if full_name:
            return full_name
        value = passenger.get("fullName") or passenger.get("full_name")
        return str(value).strip() if value else None

    async def get_file_for_admin(self, customer_id: int) -> dict[str, object] | None:
        """Assemble a customer file without credentials or bank data."""
        customer = await self.session.scalar(
            select(CustomerUser)
            .options(joinedload(CustomerUser.wallet))
            .where(CustomerUser.id == customer_id)
        )
        if customer is None:
            return None

        passengers = list(
            (
                await self.session.scalars(
                    select(CustomerPassenger)
                    .where(CustomerPassenger.customer_id == customer_id)
                    .order_by(CustomerPassenger.is_default.desc(), CustomerPassenger.id)
                )
            ).all()
        )
        bookings = list(
            (
                await self.session.scalars(
                    select(BookingRequest)
                    .options(
                        selectinload(BookingRequest.items),
                        selectinload(BookingRequest.tickets),
                    )
                    .where(BookingRequest.customer_id == customer_id)
                    .order_by(
                        BookingRequest.created_at.desc(), BookingRequest.id.desc()
                    )
                )
            ).all()
        )
        documents = list(
            (
                await self.session.scalars(
                    select(BookingDocument)
                    .where(BookingDocument.customer_id == customer_id)
                    .order_by(
                        BookingDocument.created_at.desc(), BookingDocument.id.desc()
                    )
                )
            ).all()
        )
        payments = list(
            (
                await self.session.scalars(
                    select(PaymentIntent)
                    .where(PaymentIntent.customer_user_id == customer_id)
                    .order_by(PaymentIntent.created_at.desc(), PaymentIntent.id.desc())
                )
            ).all()
        )
        visa_applications = list(
            (
                await self.session.scalars(
                    select(VisaApplication)
                    .options(
                        joinedload(VisaApplication.travel_service),
                        selectinload(VisaApplication.documents),
                    )
                    .where(VisaApplication.customer_user_id == customer_id)
                    .order_by(
                        VisaApplication.created_at.desc(), VisaApplication.id.desc()
                    )
                )
            ).all()
        )
        support_request_count = int(
            await self.session.scalar(
                select(func.count(CustomerSupportRequest.id)).where(
                    CustomerSupportRequest.customer_id == customer_id
                )
            )
            or 0
        )
        booking_by_id = {booking.id: booking for booking in bookings}
        documents_by_booking: dict[int, int] = {}
        for document in documents:
            documents_by_booking[document.booking_id] = (
                documents_by_booking.get(document.booking_id, 0) + 1
            )

        return {
            "id": customer.id,
            "full_name": customer.full_name,
            "email": customer.email,
            "phone": customer.phone,
            "emergency_phone": customer.emergency_phone,
            "national_code": customer.national_code,
            "birth_date": customer.birth_date,
            "address": customer.address,
            "is_active": customer.is_active,
            "last_login_at": customer.last_login_at,
            "created_at": customer.created_at,
            "wallet_credit": customer.wallet.available_credit if customer.wallet else 0,
            "wallet_currency": customer.wallet.currency if customer.wallet else "IRR",
            "support_request_count": support_request_count,
            "passengers": [
                {
                    "id": passenger.id,
                    "full_name": passenger.full_name,
                    "first_name_en": passenger.first_name_en,
                    "last_name_en": passenger.last_name_en,
                    "father_name": passenger.father_name,
                    "national_code": passenger.national_code,
                    "passport_number": passenger.passport_number,
                    "passport_expiry_date": passenger.passport_expiry_date,
                    "birth_date": passenger.birth_date,
                    "gender": passenger.gender,
                    "phone": passenger.phone,
                    "email": passenger.email,
                    "is_default": passenger.is_default,
                }
                for passenger in passengers
            ],
            "bookings": [
                {
                    "id": booking.id,
                    "booking_number": booking.booking_number,
                    "status": booking.status,
                    "service_titles": [item.title_snapshot for item in booking.items],
                    "total_amount": booking.total_amount,
                    "currency": booking.currency,
                    "payment_method": booking.payment_method,
                    "passenger_count": len(booking.passenger_details or []),
                    "ticket_count": len(booking.tickets),
                    "document_count": documents_by_booking.get(booking.id, 0),
                    "created_at": booking.created_at,
                    "payment_expires_at": booking.payment_expires_at,
                }
                for booking in bookings
            ],
            "tickets": [
                {
                    "ticket_number": ticket.ticket_number,
                    "passenger_name": " ".join(
                        part for part in (ticket.first_name, ticket.last_name) if part
                    ),
                    "passenger_type": ticket.passenger_type,
                    "item_type": ticket.item_type,
                    "service_title": ticket.service_title,
                    "route": ticket.route,
                    "departure_airport": ticket.departure_airport,
                    "arrival_airport": ticket.arrival_airport,
                    "departure_date": ticket.departure_date,
                    "departure_time": (
                        ticket.departure_time.isoformat()
                        if ticket.departure_time is not None
                        else None
                    ),
                    "carrier": ticket.carrier,
                    "travel_class": ticket.travel_class,
                    "baggage_allowance": ticket.baggage_allowance,
                    "issued_at": ticket.issued_at,
                }
                for booking in bookings
                for ticket in booking.tickets
            ],
            "documents": [
                {
                    "id": document.id,
                    "booking_number": (
                        booking_by_id[document.booking_id].booking_number
                        if document.booking_id in booking_by_id
                        else str(document.booking_id)
                    ),
                    "passenger_name": self._passenger_name(
                        (
                            booking_by_id[document.booking_id].passenger_details
                            if document.booking_id in booking_by_id
                            else None
                        ),
                        document.passenger_index,
                    ),
                    "original_name": document.original_name,
                    "mime_type": document.mime_type,
                    "byte_size": document.byte_size,
                    "status": document.status,
                    "review_note": document.review_note,
                    "created_at": document.created_at,
                }
                for document in documents
            ],
            "payments": [
                {
                    "crm_contract_number": payment.crm_contract_number,
                    "amount": payment.amount,
                    "currency": payment.currency,
                    "status": payment.status,
                    "provider": payment.provider,
                    "provider_reference": payment.provider_reference,
                    "verified_at": payment.verified_at,
                    "created_at": payment.created_at,
                }
                for payment in payments
            ],
            "visa_applications": [
                {
                    "id": application.id,
                    "service_title": application.travel_service.title,
                    "status": application.status,
                    "document_count": len(application.documents),
                    "created_at": application.created_at,
                    "updated_at": application.updated_at,
                }
                for application in visa_applications
            ],
        }

    async def archive_for_admin(self, customer_id: int) -> bool:
        """Hide a customer account from administrative lists without deleting data."""
        customer = await self.session.scalar(
            select(CustomerUser)
            .where(
                CustomerUser.id == customer_id,
                CustomerUser.admin_hidden_at.is_(None),
            )
            .with_for_update()
        )
        if customer is None:
            return False
        customer.admin_hidden_at = datetime.now(UTC)
        await self.session.flush()
        return True

    async def create(
        self,
        *,
        email: str,
        full_name: str,
        password_hash: str,
        account_type: str = "customer",
    ) -> CustomerUser:
        user = CustomerUser(
            email=email.lower(),
            full_name=full_name,
            password_hash=password_hash,
            account_type=account_type,
        )
        self.session.add(user)
        await self.session.flush()
        return user


class CustomerSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> CustomerSession:
        customer_session = CustomerSession(
            customer_user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.session.add(customer_session)
        await self.session.flush()
        return customer_session

    async def get_active(self, token_hash: str) -> CustomerSession | None:
        now = datetime.now(UTC)
        statement = (
            select(CustomerSession)
            .options(joinedload(CustomerSession.user))
            .where(
                CustomerSession.token_hash == token_hash,
                CustomerSession.revoked_at.is_(None),
                CustomerSession.expires_at > now,
            )
        )
        return await self.session.scalar(statement)

    async def revoke(self, token_hash: str) -> None:
        await self.session.execute(
            update(CustomerSession)
            .where(
                CustomerSession.token_hash == token_hash,
                CustomerSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )

    async def revoke_all_for_customer(self, customer_id: int) -> None:
        await self.session.execute(
            update(CustomerSession)
            .where(
                CustomerSession.customer_user_id == customer_id,
                CustomerSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )


class AvailabilityAlertRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_or_reactivate(
        self,
        *,
        customer_id: int,
        service_type: str,
        origin: str,
        destination: str,
        departure_date: date,
    ) -> AvailabilityAlert:
        statement = select(AvailabilityAlert).where(
            AvailabilityAlert.customer_id == customer_id,
            AvailabilityAlert.service_type == service_type,
            AvailabilityAlert.origin == origin,
            AvailabilityAlert.destination == destination,
            AvailabilityAlert.departure_date == departure_date,
        )
        alert = await self.session.scalar(statement)
        if alert is None:
            alert = AvailabilityAlert(
                customer_id=customer_id,
                service_type=service_type,
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                is_active=True,
            )
            self.session.add(alert)
        else:
            alert.is_active = True
            alert.notified_at = None
        await self.session.flush()
        return alert

    async def list_for_customer(self, customer_id: int) -> list[AvailabilityAlert]:
        statement = (
            select(AvailabilityAlert)
            .where(AvailabilityAlert.customer_id == customer_id)
            .order_by(AvailabilityAlert.created_at.desc(), AvailabilityAlert.id.desc())
            .limit(50)
        )
        return list((await self.session.scalars(statement)).all())


class CustomerPasswordResetTokenRepository:
    """Persistence for opaque, single-use customer password-reset tokens."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def invalidate_active_for_customer(self, customer_id: int) -> None:
        await self.session.execute(
            update(CustomerPasswordResetToken)
            .where(
                CustomerPasswordResetToken.customer_user_id == customer_id,
                CustomerPasswordResetToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )

    async def create(
        self,
        *,
        customer_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> CustomerPasswordResetToken:
        token = CustomerPasswordResetToken(
            customer_user_id=customer_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_active(self, token_hash: str) -> CustomerPasswordResetToken | None:
        statement = select(CustomerPasswordResetToken).where(
            CustomerPasswordResetToken.token_hash == token_hash,
            CustomerPasswordResetToken.used_at.is_(None),
            CustomerPasswordResetToken.expires_at > datetime.now(UTC),
        )
        return await self.session.scalar(statement)


class CustomerSmsLoginCodeRepository:
    """Persistence for a short-lived, one-use customer SMS login code."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def invalidate_active_for_phone(self, phone: str) -> None:
        await self.session.execute(
            update(CustomerSmsLoginCode)
            .where(
                CustomerSmsLoginCode.phone == phone,
                CustomerSmsLoginCode.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )

    async def create(
        self, *, phone: str, code_hash: str, expires_at: datetime
    ) -> CustomerSmsLoginCode:
        code = CustomerSmsLoginCode(
            phone=phone, code_hash=code_hash, expires_at=expires_at
        )
        self.session.add(code)
        await self.session.flush()
        return code

    async def get_active(self, phone: str) -> CustomerSmsLoginCode | None:
        statement = (
            select(CustomerSmsLoginCode)
            .where(
                CustomerSmsLoginCode.phone == phone,
                CustomerSmsLoginCode.used_at.is_(None),
                CustomerSmsLoginCode.expires_at > datetime.now(UTC),
            )
            .order_by(
                CustomerSmsLoginCode.created_at.desc(), CustomerSmsLoginCode.id.desc()
            )
            .limit(1)
        )
        return await self.session.scalar(statement)

    async def register_failed_attempt(
        self, code: CustomerSmsLoginCode, *, max_attempts: int
    ) -> None:
        code.attempts += 1
        if code.attempts >= max_attempts:
            code.used_at = datetime.now(UTC)

    async def consume(self, code: CustomerSmsLoginCode) -> None:
        code.used_at = datetime.now(UTC)
