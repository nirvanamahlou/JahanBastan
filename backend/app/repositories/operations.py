"""Database access for local sales, retention and moderation workflows."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from secrets import token_hex

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    BookingItem,
    BookingRequest,
    BookingStatus,
    CancellationRequest,
    CustomerLead,
    CustomerNotification,
    CustomerSupportRequest,
    CustomerUser,
    DiscountCode,
    LeadActivity,
    NewsletterSubscriber,
    PaymentIntent,
    PaymentStatus,
    ProductReview,
)
from app.models.checkout import BookingStatusEvent
from app.repositories.agencies import AgencyRepository
from app.repositories.bookings import BookingRepository
from app.schemas.operations import (
    CancellationCreate,
    CancellationUpdate,
    DiscountCodeCreate,
    DiscountCodeUpdate,
    LeadCreate,
    LeadUpdate,
    NewsletterSubscribe,
    ProductReviewCreate,
    ProductReviewUpdate,
)


class OperationsRepository:
    """Keeps commercial workflow queries bounded and relationship-safe."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _lead_options():
        return (selectinload(CustomerLead.activities),)

    async def create_lead(
        self, customer: CustomerUser, payload: LeadCreate
    ) -> CustomerLead:
        lead = CustomerLead(
            customer_id=customer.id,
            source="quote",
            subject=payload.subject.strip(),
            details=payload.details.strip() if payload.details else None,
            contact_name=payload.contact_name.strip(),
            contact_phone=payload.contact_phone.strip()
            if payload.contact_phone
            else customer.phone,
            contact_email=str(payload.contact_email or customer.email),
            expected_amount=payload.expected_amount,
            currency=payload.currency,
        )
        lead.activities = [
            LeadActivity(
                activity_type="created", body="درخواست قیمت توسط مشتری ثبت شد."
            )
        ]
        self.session.add(lead)
        await self.session.flush()
        return await self.get_lead(lead.id)

    async def get_lead(self, lead_id: int) -> CustomerLead | None:
        return await self.session.scalar(
            select(CustomerLead)
            .options(*self._lead_options())
            .where(CustomerLead.id == lead_id)
        )

    async def list_customer_leads(self, customer_id: int) -> list[CustomerLead]:
        result = await self.session.scalars(
            select(CustomerLead)
            .options(*self._lead_options())
            .where(CustomerLead.customer_id == customer_id)
            .order_by(CustomerLead.updated_at.desc(), CustomerLead.id.desc())
            .limit(100)
        )
        return list(result.unique().all())

    async def list_admin_leads(self, status: str | None = None) -> list[CustomerLead]:
        statement = (
            select(CustomerLead)
            .options(*self._lead_options())
            .order_by(CustomerLead.updated_at.desc(), CustomerLead.id.desc())
            .limit(200)
        )
        if status:
            statement = statement.where(CustomerLead.status == status)
        return list((await self.session.scalars(statement)).unique().all())

    async def update_lead(
        self, lead: CustomerLead, payload: LeadUpdate, admin_id: int
    ) -> CustomerLead:
        changes: list[str] = []
        if payload.status is not None and payload.status != lead.status:
            changes.append(f"وضعیت از {lead.status} به {payload.status} تغییر کرد.")
            lead.status = payload.status
        if payload.priority is not None and payload.priority != lead.priority:
            changes.append(f"اولویت به {payload.priority} تغییر کرد.")
            lead.priority = payload.priority
        if payload.assigned_admin_id is not None:
            lead.assigned_admin_id = payload.assigned_admin_id
            changes.append("مسئول پیگیری به‌روزرسانی شد.")
        if payload.next_follow_up_at is not None:
            lead.next_follow_up_at = payload.next_follow_up_at
            changes.append("زمان پیگیری بعدی ثبت شد.")
        if payload.activity_note:
            changes.append(payload.activity_note.strip())
        lead.updated_at = datetime.now(UTC)
        for body in changes:
            lead.activities.append(
                LeadActivity(admin_id=admin_id, activity_type="update", body=body)
            )
        await self.session.flush()
        return await self.get_lead(lead.id)

    async def create_cancellation(
        self, customer_id: int, booking_id: int, payload: CancellationCreate
    ) -> CancellationRequest:
        booking = await self.session.scalar(
            select(BookingRequest).where(
                BookingRequest.id == booking_id,
                BookingRequest.customer_id == customer_id,
            )
        )
        if booking is None:
            raise LookupError("booking not found")
        if booking.status == "rejected":
            raise ValueError("rejected bookings cannot be cancelled")
        existing = await self.session.scalar(
            select(CancellationRequest).where(
                CancellationRequest.booking_id == booking_id
            )
        )
        if existing is not None:
            raise ValueError("a cancellation request already exists for this booking")
        value = CancellationRequest(
            customer_id=customer_id,
            booking_id=booking_id,
            reason=payload.reason.strip(),
        )
        self.session.add(value)
        await self.session.flush()
        await self.create_notification(
            customer_id,
            notification_type="cancellation",
            title="درخواست لغو ثبت شد",
            body="درخواست شما برای بررسی به کارشناسان ارسال شد.",
            link="/account/?tab=trips",
        )
        return value

    async def list_customer_cancellations(
        self, customer_id: int
    ) -> list[CancellationRequest]:
        result = await self.session.scalars(
            select(CancellationRequest)
            .where(CancellationRequest.customer_id == customer_id)
            .order_by(CancellationRequest.updated_at.desc())
            .limit(100)
        )
        return list(result.all())

    async def list_admin_cancellations(
        self, status: str | None = None
    ) -> list[CancellationRequest]:
        statement = (
            select(CancellationRequest)
            .order_by(CancellationRequest.updated_at.desc())
            .limit(200)
        )
        if status:
            statement = statement.where(CancellationRequest.status == status)
        return list((await self.session.scalars(statement)).all())

    async def update_cancellation(
        self, value: CancellationRequest, payload: CancellationUpdate, admin_id: int
    ) -> CancellationRequest:
        allowed_transitions = {
            "requested": {"in_review", "approved", "rejected"},
            "in_review": {"approved", "rejected"},
            "approved": {"completed", "rejected"},
            "rejected": set(),
            "completed": set(),
        }
        if value.status == "completed":
            raise ValueError("درخواست لغو تکمیل شده و قابل ویرایش نیست")
        if (
            payload.status != value.status
            and payload.status not in allowed_transitions.get(value.status, set())
        ):
            raise ValueError("تغییر وضعیت درخواست لغو در این مرحله مجاز نیست")
        if payload.status == "completed" and value.status != "approved":
            raise ValueError("بازپرداخت فقط پس از تأیید درخواست لغو ثبت می‌شود")

        value.status = payload.status
        value.resolution_note = (
            payload.resolution_note.strip() if payload.resolution_note else None
        )
        value.refund_amount = payload.refund_amount
        value.reviewed_by_admin_id = admin_id
        value.reviewed_at = datetime.now(UTC)

        if payload.status == "completed":
            booking = await self.session.scalar(
                select(BookingRequest)
                .options(selectinload(BookingRequest.items))
                .where(BookingRequest.id == value.booking_id)
                .with_for_update()
            )
            if booking is None:
                raise ValueError("رزرو مربوط به درخواست لغو یافت نشد")
            previous_status = booking.status
            booking_repository = BookingRepository(self.session)
            await booking_repository.release_booking_capacity(booking)
            await booking_repository.release_booking_discount(booking)
            booking.status = BookingStatus.CANCELLED
            booking.checkout_step = "cancelled"
            self.session.add(
                BookingStatusEvent(
                    booking_id=booking.id,
                    actor_type="admin",
                    actor_id=admin_id,
                    event_type="booking_cancelled",
                    from_status=previous_status,
                    to_status="cancelled",
                    note=value.resolution_note,
                    payload={"cancellationId": value.id},
                )
            )

            if payload.refund_amount and payload.refund_amount > 0:
                payment = await self.session.scalar(
                    select(PaymentIntent)
                    .where(
                        PaymentIntent.customer_user_id == value.customer_id,
                        PaymentIntent.crm_contract_number == booking.booking_number,
                        PaymentIntent.status.in_(
                            (
                                PaymentStatus.PAID,
                                PaymentStatus.CRM_SYNC_PENDING,
                                PaymentStatus.CRM_SYNCED,
                                PaymentStatus.PARTIALLY_REFUNDED,
                            )
                        ),
                    )
                    .order_by(PaymentIntent.created_at.desc())
                    .with_for_update()
                )
                if payment is None:
                    raise ValueError("پرداخت تأییدشده‌ای برای ثبت بازپرداخت یافت نشد")
                remaining = payment.amount - payment.refunded_amount
                if payload.refund_amount > remaining:
                    raise ValueError("مبلغ بازپرداخت بیشتر از مبلغ قابل بازگشت است")
                if booking.payment_method == "agency_credit":
                    await AgencyRepository(self.session).refund_booking(
                        booking, payload.refund_amount
                    )
                payment.refunded_amount += payload.refund_amount
                payment.status = (
                    PaymentStatus.REFUNDED
                    if payment.refunded_amount == payment.amount
                    else PaymentStatus.PARTIALLY_REFUNDED
                )
                value.refund_status = "recorded"
                value.refund_reference = f"JB-RF-{token_hex(5).upper()}"
                value.refunded_at = datetime.now(UTC)
            else:
                value.refund_status = "not_required"

        await self.create_notification(
            value.customer_id,
            notification_type="cancellation",
            title="وضعیت درخواست لغو به‌روزرسانی شد",
            body=(
                value.resolution_note
                or (
                    "لغو و بازپرداخت شما ثبت شد."
                    if value.status == "completed"
                    else f"وضعیت جدید: {value.status}"
                )
            ),
            link="/account/?tab=trips",
        )
        await self.session.flush()
        return value

    async def subscribe_newsletter(
        self, payload: NewsletterSubscribe
    ) -> NewsletterSubscriber:
        email = str(payload.email).lower()
        value = await self.session.scalar(
            select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
        )
        if value is None:
            value = NewsletterSubscriber(
                email=email,
                full_name=payload.full_name.strip() if payload.full_name else None,
                phone=payload.phone.strip() if payload.phone else None,
            )
            self.session.add(value)
        else:
            value.is_active = True
            value.full_name = (
                payload.full_name.strip() if payload.full_name else value.full_name
            )
            value.phone = payload.phone.strip() if payload.phone else value.phone
            value.consent_at = datetime.now(UTC)
        await self.session.flush()
        return value

    async def list_newsletter(self) -> list[NewsletterSubscriber]:
        return list(
            (
                await self.session.scalars(
                    select(NewsletterSubscriber)
                    .order_by(NewsletterSubscriber.created_at.desc())
                    .limit(500)
                )
            ).all()
        )

    async def create_discount(self, payload: DiscountCodeCreate) -> DiscountCode:
        code = payload.code.strip().upper()
        if await self.session.scalar(
            select(DiscountCode).where(DiscountCode.code == code)
        ):
            raise ValueError("discount code already exists")
        if payload.discount_type == "percentage" and payload.amount > 100:
            raise ValueError("percentage discount cannot exceed 100")
        value = DiscountCode(
            code=code,
            title=payload.title.strip(),
            discount_type=payload.discount_type,
            amount=payload.amount,
            percentage_limit=payload.percentage_limit,
            max_uses=payload.max_uses,
            minimum_order_amount=payload.minimum_order_amount,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            applies_to=payload.applies_to,
        )
        self.session.add(value)
        await self.session.flush()
        return value

    async def list_discounts(self) -> list[DiscountCode]:
        return list(
            (
                await self.session.scalars(
                    select(DiscountCode)
                    .order_by(DiscountCode.created_at.desc())
                    .limit(200)
                )
            ).all()
        )

    async def update_discount(
        self, value: DiscountCode, payload: DiscountCodeUpdate
    ) -> DiscountCode:
        if payload.title is not None:
            value.title = payload.title.strip()
        if payload.is_active is not None:
            value.is_active = payload.is_active
        if payload.max_uses is not None:
            value.max_uses = payload.max_uses
        if payload.ends_at is not None:
            value.ends_at = payload.ends_at
        await self.session.flush()
        return value

    async def create_review(
        self, customer: CustomerUser, payload: ProductReviewCreate
    ) -> ProductReview:
        conditions = [
            ProductReview.customer_id == customer.id,
            ProductReview.target_type == payload.target_type,
        ]
        if payload.target_type == "page":
            conditions.append(ProductReview.page_path == payload.page_path)
        else:
            conditions.append(ProductReview.target_id == payload.target_id)
        existing = await self.session.scalar(select(ProductReview).where(*conditions))
        if existing is not None:
            raise ValueError("you have already reviewed this item")
        value = ProductReview(
            customer_id=customer.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            page_path=payload.page_path,
            page_title=payload.page_title.strip() if payload.page_title else None,
            author_name_snapshot=customer.full_name,
            rating=payload.rating,
            title=payload.title.strip() if payload.title else None,
            body=payload.body.strip(),
        )
        self.session.add(value)
        await self.session.flush()
        return value

    async def list_public_reviews(
        self,
        target_type: str,
        target_id: int | None = None,
        page_path: str | None = None,
    ) -> list[ProductReview]:
        target_clause = (
            ProductReview.page_path == page_path
            if target_type == "page"
            else ProductReview.target_id == target_id
        )
        return list(
            (
                await self.session.scalars(
                    select(ProductReview)
                    .where(
                        ProductReview.target_type == target_type,
                        target_clause,
                        ProductReview.status == "approved",
                    )
                    .order_by(ProductReview.created_at.desc())
                    .limit(100)
                )
            ).all()
        )

    async def list_admin_reviews(
        self, status: str | None = None
    ) -> list[ProductReview]:
        statement = (
            select(ProductReview).order_by(ProductReview.created_at.desc()).limit(200)
        )
        if status:
            statement = statement.where(ProductReview.status == status)
        return list((await self.session.scalars(statement)).all())

    async def update_review(
        self, value: ProductReview, payload: ProductReviewUpdate, admin_id: int
    ) -> ProductReview:
        value.status = payload.status
        value.moderation_note = (
            payload.moderation_note.strip() if payload.moderation_note else None
        )
        value.moderated_by_admin_id = admin_id
        value.moderated_at = datetime.now(UTC)
        await self.create_notification(
            value.customer_id,
            notification_type="review",
            title="نظر شما بررسی شد",
            body="نظر شما منتشر شد."
            if value.status == "approved"
            else "نظر شما منتشر نشد.",
            link=value.page_path,
        )
        await self.session.flush()
        return value

    async def list_notifications(self, customer_id: int) -> list[CustomerNotification]:
        return list(
            (
                await self.session.scalars(
                    select(CustomerNotification)
                    .where(CustomerNotification.customer_id == customer_id)
                    .order_by(CustomerNotification.created_at.desc())
                    .limit(100)
                )
            ).all()
        )

    async def mark_notification_read(
        self, customer_id: int, notification_id: int
    ) -> CustomerNotification | None:
        value = await self.session.scalar(
            select(CustomerNotification).where(
                CustomerNotification.id == notification_id,
                CustomerNotification.customer_id == customer_id,
            )
        )
        if value is not None:
            value.is_read = True
            await self.session.flush()
        return value

    async def create_notification(
        self,
        customer_id: int,
        *,
        notification_type: str,
        title: str,
        body: str,
        link: str | None,
    ) -> CustomerNotification:
        value = CustomerNotification(
            customer_id=customer_id,
            notification_type=notification_type,
            title=title,
            body=body,
            link=link,
        )
        self.session.add(value)
        await self.session.flush()
        return value

    async def dashboard(self) -> dict[str, int | Decimal]:
        async def count(statement) -> int:
            return int((await self.session.scalar(statement)) or 0)

        confirmed_revenue = await self.session.scalar(
            select(func.coalesce(func.sum(BookingRequest.total_amount), 0)).where(
                BookingRequest.status.in_(("approved", "paid"))
            )
        )
        return {
            "bookings_total": await count(
                select(func.count()).select_from(BookingRequest)
            ),
            "bookings_pending": await count(
                select(func.count())
                .select_from(BookingRequest)
                .where(BookingRequest.status == "pending_review")
            ),
            "bookings_paid": await count(
                select(func.count())
                .select_from(BookingRequest)
                .where(BookingRequest.status == "paid")
            ),
            "confirmed_revenue": Decimal(confirmed_revenue or 0),
            "customers_total": await count(
                select(func.count()).select_from(CustomerUser)
            ),
            "leads_open": await count(
                select(func.count())
                .select_from(CustomerLead)
                .where(CustomerLead.status.not_in(("won", "lost")))
            ),
            "cancellation_open": await count(
                select(func.count())
                .select_from(CancellationRequest)
                .where(CancellationRequest.status.in_(("requested", "in_review")))
            ),
            "support_open": await count(
                select(func.count())
                .select_from(CustomerSupportRequest)
                .where(CustomerSupportRequest.status != "closed")
            ),
            "reviews_pending": await count(
                select(func.count())
                .select_from(ProductReview)
                .where(ProductReview.status == "pending")
            ),
            "newsletter_active": await count(
                select(func.count())
                .select_from(NewsletterSubscriber)
                .where(NewsletterSubscriber.is_active.is_(True))
            ),
        }

    async def extended_dashboard(self) -> dict[str, object]:
        """Return financial and demand metrics for the internal manager dashboard."""
        base = await self.dashboard()
        refund_total = await self.session.scalar(
            select(func.coalesce(func.sum(PaymentIntent.refunded_amount), 0))
        )
        popular_rows = (
            await self.session.execute(
                select(
                    BookingItem.title_snapshot,
                    func.count(BookingItem.id).label("bookings"),
                )
                .where(BookingItem.item_type == "tour")
                .group_by(BookingItem.title_snapshot)
                .order_by(func.count(BookingItem.id).desc(), BookingItem.title_snapshot)
                .limit(5)
            )
        ).all()
        active_customer_cutoff = datetime.now(UTC) - timedelta(days=30)
        base.update(
            {
                "bookings_cancelled": int(
                    (
                        await self.session.scalar(
                            select(func.count())
                            .select_from(BookingRequest)
                            .where(BookingRequest.status == "cancelled")
                        )
                    )
                    or 0
                ),
                "payments_pending": int(
                    (
                        await self.session.scalar(
                            select(func.count())
                            .select_from(PaymentIntent)
                            .where(
                                PaymentIntent.status.in_(
                                    (
                                        PaymentStatus.PENDING,
                                        PaymentStatus.GATEWAY_PENDING,
                                    )
                                )
                            )
                        )
                    )
                    or 0
                ),
                "refund_total": Decimal(refund_total or 0),
                "customers_active_30_days": int(
                    (
                        await self.session.scalar(
                            select(
                                func.count(func.distinct(BookingRequest.customer_id))
                            ).where(BookingRequest.created_at >= active_customer_cutoff)
                        )
                    )
                    or 0
                ),
                "popular_tours": [
                    {"title": row.title_snapshot, "bookings": int(row.bookings)}
                    for row in popular_rows
                ],
            }
        )
        return base
