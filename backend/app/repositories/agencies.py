"""Agency onboarding and concurrency-safe business credit operations."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.content import (
    AgencyCreditEvent,
    AgencyProfile,
    BookingRequest,
    CustomerUser,
)


class AgencyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_profile(
        self,
        *,
        customer_id: int,
        legal_name: str,
        registration_number: str,
        national_id: str | None,
        economic_code: str | None,
        license_number: str,
        manager_name: str,
        manager_national_code: str,
        phone: str,
        province: str,
        city: str,
        address: str,
        postal_code: str | None,
    ) -> AgencyProfile:
        profile = AgencyProfile(
            customer_id=customer_id,
            legal_name=legal_name,
            registration_number=registration_number,
            national_id=national_id,
            economic_code=economic_code,
            license_number=license_number,
            manager_name=manager_name,
            manager_national_code=manager_national_code,
            phone=phone,
            province=province,
            city=city,
            address=address,
            postal_code=postal_code,
        )
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def get_for_customer(
        self, customer_id: int, *, for_update: bool = False
    ) -> AgencyProfile | None:
        statement = select(AgencyProfile).where(
            AgencyProfile.customer_id == customer_id
        )
        if for_update:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def list_for_admin(
        self, *, status: str | None, query: str | None
    ) -> list[AgencyProfile]:
        statement = (
            select(AgencyProfile)
            .options(joinedload(AgencyProfile.customer))
            .order_by(AgencyProfile.created_at.desc(), AgencyProfile.id.desc())
            .limit(200)
        )
        if status:
            statement = statement.where(AgencyProfile.status == status)
        if query and (normalized := query.strip()):
            match = f"%{normalized}%"
            statement = statement.join(AgencyProfile.customer).where(
                or_(
                    AgencyProfile.legal_name.ilike(match),
                    AgencyProfile.national_id.ilike(match),
                    AgencyProfile.registration_number.ilike(match),
                    CustomerUser.email.ilike(match),
                    CustomerUser.full_name.ilike(match),
                )
            )
        return list((await self.session.scalars(statement)).unique().all())

    async def get_for_admin(
        self, profile_id: int, *, for_update: bool = False
    ) -> AgencyProfile | None:
        statement = (
            select(AgencyProfile)
            .options(joinedload(AgencyProfile.customer))
            .where(AgencyProfile.id == profile_id)
        )
        if for_update:
            statement = statement.with_for_update(of=AgencyProfile)
        return await self.session.scalar(statement)

    async def review(
        self,
        profile: AgencyProfile,
        *,
        status: str,
        credit_limit: Decimal,
        admin_id: int,
        note: str | None,
    ) -> AgencyProfile:
        if status != "approved" and (
            profile.credit_used > 0 or profile.credit_reserved > 0
        ):
            raise ValueError("آژانسی که اعتبار مصرف‌شده یا رزروشده دارد قابل رد نیست")
        if credit_limit < profile.credit_used + profile.credit_reserved:
            raise ValueError(
                "سقف اعتبار نمی‌تواند از اعتبار مصرف‌شده و رزروشده کمتر باشد"
            )
        previous_limit = profile.credit_limit
        profile.status = status
        profile.credit_limit = credit_limit if status == "approved" else Decimal(0)
        profile.review_note = note.strip() if note and note.strip() else None
        profile.reviewed_by_admin_id = admin_id
        profile.reviewed_at = datetime.now(UTC)
        self._add_event(
            profile,
            event_type="agency_approved" if status == "approved" else "agency_rejected",
            amount=abs(profile.credit_limit - previous_limit),
            admin_id=admin_id,
            note=profile.review_note,
        )
        await self.session.flush()
        return profile

    async def reserve_for_booking(
        self, booking: BookingRequest, amount: Decimal
    ) -> None:
        if amount <= 0:
            raise ValueError("مبلغ خرید اعتباری معتبر نیست")
        profile = await self.get_for_customer(booking.customer_id, for_update=True)
        if profile is None or profile.status != "approved":
            raise ValueError("حساب آژانس هنوز برای خرید اعتباری تأیید نشده است")
        available = profile.credit_limit - profile.credit_used - profile.credit_reserved
        if amount > available:
            raise ValueError("اعتبار قابل استفاده آژانس برای این خرید کافی نیست")
        profile.credit_reserved += amount
        booking.agency_credit_reserved_amount = amount
        self._add_event(
            profile,
            event_type="credit_reserved",
            amount=amount,
            booking_id=booking.id,
        )
        await self.session.flush()

    async def release_booking_reservation(self, booking: BookingRequest) -> None:
        amount = booking.agency_credit_reserved_amount
        if amount <= 0:
            return
        profile = await self.get_for_customer(booking.customer_id, for_update=True)
        if profile is None:
            raise ValueError("پروفایل آژانس برای آزادسازی اعتبار یافت نشد")
        profile.credit_reserved = max(Decimal(0), profile.credit_reserved - amount)
        booking.agency_credit_reserved_amount = Decimal(0)
        self._add_event(
            profile,
            event_type="credit_released",
            amount=amount,
            booking_id=booking.id,
        )
        await self.session.flush()

    async def settle_booking(self, booking: BookingRequest, amount: Decimal) -> None:
        profile = await self.get_for_customer(booking.customer_id, for_update=True)
        if profile is None or profile.status != "approved":
            raise ValueError("حساب آژانس برای تسویه اعتباری فعال نیست")
        reserved = booking.agency_credit_reserved_amount
        available_after_release = (
            profile.credit_limit
            - profile.credit_used
            - profile.credit_reserved
            + reserved
        )
        if amount > available_after_release:
            raise ValueError("اعتبار آژانس برای مبلغ نهایی رزرو کافی نیست")
        profile.credit_reserved = max(Decimal(0), profile.credit_reserved - reserved)
        profile.credit_used += amount
        booking.agency_credit_reserved_amount = Decimal(0)
        booking.agency_credit_charged_amount = amount
        self._add_event(
            profile,
            event_type="credit_charged",
            amount=amount,
            booking_id=booking.id,
        )
        await self.session.flush()

    async def refund_booking(self, booking: BookingRequest, amount: Decimal) -> None:
        refundable = min(amount, booking.agency_credit_charged_amount)
        if refundable <= 0:
            return
        profile = await self.get_for_customer(booking.customer_id, for_update=True)
        if profile is None:
            raise ValueError("پروفایل آژانس برای بازگرداندن اعتبار یافت نشد")
        profile.credit_used = max(Decimal(0), profile.credit_used - refundable)
        booking.agency_credit_charged_amount -= refundable
        self._add_event(
            profile,
            event_type="credit_refunded",
            amount=refundable,
            booking_id=booking.id,
        )
        await self.session.flush()

    def _add_event(
        self,
        profile: AgencyProfile,
        *,
        event_type: str,
        amount: Decimal,
        booking_id: int | None = None,
        admin_id: int | None = None,
        note: str | None = None,
    ) -> None:
        self.session.add(
            AgencyCreditEvent(
                agency_profile_id=profile.id,
                booking_id=booking_id,
                admin_id=admin_id,
                event_type=event_type,
                amount=amount,
                credit_limit_after=profile.credit_limit,
                credit_used_after=profile.credit_used,
                credit_reserved_after=profile.credit_reserved,
                note=note,
            )
        )
