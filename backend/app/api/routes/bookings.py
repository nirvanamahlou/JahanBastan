"""Customer booking creation, document download, and admin approval endpoints."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from starlette.responses import StreamingResponse

from app.api.dependencies.auth import (
    CurrentAdmin,
    CurrentCustomer,
    DatabaseSession,
    TrustedOrigin,
)
from app.models import PaymentIntent, PaymentStatus, SiteSetting
from app.models.checkout import BookingStatusEvent
from app.repositories.agencies import AgencyRepository
from app.repositories.bookings import (
    BookingRepository,
    DirectPriceChanged,
    DirectRequestMismatch,
    HotelUnavailableError,
)
from app.repositories.operations import OperationsRepository
from app.schemas.booking import (
    AdminBookingRead,
    BookingCreate,
    BookingPaymentConfirmation,
    BookingRead,
    BookingReview,
    BookingTicketRead,
)
from app.services.booking_pdf import (
    create_booking_invoice_pdf,
    create_booking_proforma_pdf,
)
from app.services.currency import exchange_rates_from_links, item_total_to_toman
from app.services.online_sales import require_online_sales_enabled
from app.services.ticket_issuance import issue_booking_tickets
from app.services.ticket_pdf import create_booking_ticket_pdf

customer_router = APIRouter(prefix="/account/bookings", tags=["account-bookings"])
admin_router = APIRouter(prefix="/admin/bookings", tags=["admin-bookings"])


async def _pdf_totals(booking, session):
    if booking.total_amount is None or (booking.currency or "").upper() == "IRT":
        return booking.total_amount, booking.currency
    settings = await session.get(SiteSetting, 1)
    rates = exchange_rates_from_links(settings.social_links if settings else {})
    amounts = [item_total_to_toman(item, rates) for item in booking.items]
    if amounts and all(amount is not None and amount > 0 for amount in amounts):
        return sum((amount or Decimal(0) for amount in amounts), Decimal(0)), "IRT"
    return booking.total_amount, booking.currency


def require_reviewer(admin: CurrentAdmin) -> None:
    if admin.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="reviewer role required")


@customer_router.post(
    "",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreate,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> BookingRead:
    await require_online_sales_enabled(session)
    try:
        repository = BookingRepository(session)
        key = str(payload.direct_request_key) if payload.direct_request_key else None
        digest = None
        if key is not None:
            canonical = json.dumps(
                payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
            )
            digest = hashlib.sha256(canonical.encode()).hexdigest()
            replay = await repository.find_direct_replay(customer.id, key, digest)
            if replay is not None:
                return BookingRead.model_validate(replay)
        booking = await repository.create_from_cart(
            customer.id,
            payload.customer_note,
            [
                passenger.model_dump(
                    exclude={"id", "is_default"},
                    mode="json",
                )
                for passenger in payload.passengers
            ],
            payment_method=payload.payment_method,
            terms_accepted=payload.terms_accepted,
            terms_version=payload.terms_version,
            discount_code=payload.discount_code,
            tour_selection=payload.tour_selection,
            accepted_total_irt=payload.accepted_total_irt,
            direct_request_key=key,
            direct_request_digest=digest,
        )
        await OperationsRepository(session).create_notification(
            customer.id,
            notification_type="booking",
            title="درخواست رزرو ثبت شد",
            body=(
                "ظرفیت انتخاب‌شده تا بررسی کارشناسان به‌صورت موقت نگه‌داری "
                "می‌شود. نتیجه از بخش پیگیری رزرو قابل مشاهده است."
            ),
            link="/account/operations/",
        )
        await session.commit()
    except DirectPriceChanged as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "code": "price_changed",
                "message": str(exc),
                "finalTotalIrt": str(exc.total) if exc.total is not None else None,
            },
        ) from exc
    except DirectRequestMismatch as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "request_key_conflict", "message": str(exc)},
        ) from exc
    except HotelUnavailableError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "selected_hotel_unavailable",
                "message": str(exc),
                "alternatives": exc.alternatives,
            },
        ) from exc
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    value = await BookingRepository(session).get_customer_booking(
        customer.id,
        booking.id,
    )
    return BookingRead.model_validate(value)


@customer_router.get("", response_model=list[BookingRead])
async def list_bookings(
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[BookingRead]:
    values = await BookingRepository(session).list_customer_bookings(customer.id)
    return [BookingRead.model_validate(value) for value in values]


@customer_router.delete(
    "/{booking_id}/history",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def archive_booking_from_customer_history(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> Response:
    try:
        archived = await BookingRepository(session).archive_customer_booking(
            customer.id, booking_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    if not archived:
        raise HTTPException(status_code=404, detail="booking not found")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@customer_router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> BookingRead:
    value = await BookingRepository(session).get_customer_booking(
        customer.id,
        booking_id,
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    return BookingRead.model_validate(value)


@customer_router.get("/{booking_id}/proforma.pdf")
async def download_proforma(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> StreamingResponse:
    value = await BookingRepository(session).get_customer_booking(
        customer.id,
        booking_id,
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if value.status != "pending_review":
        raise HTTPException(
            status_code=409,
            detail="proforma is only available while booking is pending review",
        )
    display_total, display_currency = await _pdf_totals(value, session)
    content = await create_booking_proforma_pdf(
        value, display_total=display_total, display_currency=display_currency
    )
    return StreamingResponse(
        BytesIO(content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="proforma-{value.booking_number}.pdf"'
            )
        },
    )


@customer_router.get("/{booking_id}/invoice.pdf")
async def download_invoice(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> StreamingResponse:
    value = await BookingRepository(session).get_customer_booking(
        customer.id,
        booking_id,
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if value.status not in {"approved", "paid"}:
        raise HTTPException(
            status_code=409,
            detail="invoice is available after payment approval",
        )
    display_total, display_currency = await _pdf_totals(value, session)
    content = await create_booking_invoice_pdf(
        value, display_total=display_total, display_currency=display_currency
    )
    return StreamingResponse(
        BytesIO(content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="invoice-{value.booking_number}.pdf"'
            )
        },
    )


@customer_router.get("/{booking_id}/tickets", response_model=list[BookingTicketRead])
async def list_tickets(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[BookingTicketRead]:
    value = await BookingRepository(session).get_customer_booking(
        customer.id, booking_id
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if value.status != "paid":
        raise HTTPException(
            status_code=409, detail="tickets are available after payment confirmation"
        )
    return [BookingTicketRead.model_validate(ticket) for ticket in value.tickets]


@customer_router.get("/{booking_id}/tickets/{ticket_id}/pdf")
async def download_ticket(
    booking_id: int,
    ticket_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
    download: bool = Query(default=False),
) -> StreamingResponse:
    value = await BookingRepository(session).get_customer_booking(
        customer.id, booking_id
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if value.status != "paid":
        raise HTTPException(
            status_code=409, detail="tickets are available after payment confirmation"
        )
    ticket = next((item for item in value.tickets if item.id == ticket_id), None)
    if ticket is None:
        raise HTTPException(status_code=404, detail="ticket not found")
    content = await create_booking_ticket_pdf(value, ticket)
    disposition = "attachment" if download else "inline"
    return StreamingResponse(
        BytesIO(content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="ticket-{ticket.ticket_number}.pdf"'
            )
        },
    )


@admin_router.get("", response_model=list[AdminBookingRead])
async def admin_list_bookings(
    session: DatabaseSession,
    admin: CurrentAdmin,
    booking_status: str | None = Query(default=None, alias="status"),
) -> list[AdminBookingRead]:
    require_reviewer(admin)
    values = await BookingRepository(session).list_admin_bookings(booking_status)
    return [AdminBookingRead.model_validate(value) for value in values]


@admin_router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expired_booking(
    booking_id: int,
    session: DatabaseSession,
    admin: CurrentAdmin,
    _trusted_origin: TrustedOrigin,
) -> None:
    require_reviewer(admin)
    try:
        deleted = await BookingRepository(session).delete_expired_booking(
            booking_id, admin.id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="booking not found"
        )
    await session.commit()


@admin_router.patch("/{booking_id}", response_model=AdminBookingRead)
async def review_booking(
    booking_id: int,
    payload: BookingReview,
    session: DatabaseSession,
    admin: CurrentAdmin,
    _trusted_origin: TrustedOrigin,
) -> AdminBookingRead:
    require_reviewer(admin)
    value = await BookingRepository(session).get_admin_booking(
        booking_id, for_update=True
    )
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    previous_status = value.status
    if (
        payload.status == "rejected"
        and previous_status == "paid"
        and value.payment_method == "agency_credit"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "برای برگشت خرید اعتباری پرداخت‌شده از فرایند لغو و "
                "بازپرداخت استفاده کنید"
            ),
        )
    if payload.status == "rejected":
        if previous_status not in {"pending_review", "approved", "paid"}:
            raise HTTPException(
                status_code=409,
                detail="booking cannot be rejected in its current state",
            )
    elif previous_status != "pending_review":
        raise HTTPException(status_code=409, detail="booking was already reviewed")
    repository = BookingRepository(session)
    if payload.status == "approved":
        try:
            await repository.reserve_booking_capacity(value)
        except HotelUnavailableError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "selected_hotel_unavailable",
                    "message": str(exc),
                    "alternatives": exc.alternatives,
                },
            ) from exc
    elif payload.status == "rejected":
        await repository.release_booking_capacity(value)
        await repository.release_booking_discount(value)
        agency_repository = AgencyRepository(session)
        await agency_repository.release_booking_reservation(value)
        if value.agency_credit_charged_amount > 0:
            await agency_repository.refund_booking(
                value, value.agency_credit_charged_amount
            )
        for ticket in list(value.tickets):
            await session.delete(ticket)
    value.status = payload.status
    if payload.status == "approved":
        value.total_amount = payload.total_amount
        value.currency = payload.currency
        if value.payment_method == "agency_credit":
            if payload.currency != "IRT" or payload.total_amount is None:
                raise HTTPException(
                    status_code=409,
                    detail="خرید اعتباری آژانس باید با مبلغ نهایی تومانی تأیید شود",
                )
            try:
                await AgencyRepository(session).settle_booking(
                    value, payload.total_amount
                )
                value.status = "paid"
                value.paid_at = datetime.now(UTC)
                value.payment_expires_at = None
                value.checkout_step = "fulfillment"
                session.add(
                    PaymentIntent(
                        customer_user_id=value.customer_id,
                        crm_contract_number=value.booking_number,
                        amount=payload.total_amount,
                        currency="IRT",
                        status=PaymentStatus.PAID,
                        provider="agency_credit",
                        provider_reference=f"AGENCY-{value.booking_number}",
                        verified_at=datetime.now(UTC),
                    )
                )
                await issue_booking_tickets(session, value.id)
            except ValueError as exc:
                await session.rollback()
                raise HTTPException(status_code=409, detail=str(exc)) from exc
        else:
            value.payment_expires_at = datetime.now(UTC) + timedelta(minutes=30)
            value.checkout_step = "payment"
    elif payload.status == "rejected":
        value.payment_expires_at = None
        value.checkout_step = "rejected"
    value.admin_note = (
        payload.admin_note.strip()
        if payload.admin_note and payload.admin_note.strip()
        else None
    )
    value.reviewed_by_admin_id = admin.id
    value.reviewed_at = datetime.now(UTC)
    session.add(
        BookingStatusEvent(
            booking_id=value.id,
            actor_type="admin",
            actor_id=admin.id,
            event_type=(
                "booking_approved_and_agency_credit_settled"
                if payload.status == "approved"
                and value.payment_method == "agency_credit"
                else f"booking_{payload.status}"
            ),
            from_status=previous_status,
            to_status=value.status,
            note=value.admin_note,
            payload={
                "totalAmount": (
                    str(payload.total_amount)
                    if payload.total_amount is not None
                    else None
                ),
                "currency": payload.currency,
                "paymentExpiresAt": (
                    value.payment_expires_at.isoformat()
                    if value.payment_expires_at is not None
                    else None
                ),
            },
        )
    )
    await OperationsRepository(session).create_notification(
        value.customer_id,
        notification_type="booking",
        title=(
            "رزرو با اعتبار آژانسی نهایی شد"
            if payload.status == "approved" and value.payment_method == "agency_credit"
            else "رزرو شما تأیید شد"
            if payload.status == "approved"
            else "رزرو شما تأیید نشد"
        ),
        body=(
            (
                "مبلغ رزرو از اعتبار آژانس کسر شد و اسناد سفر در "
                "پیگیری رزرو در دسترس است."
                if value.payment_method == "agency_credit"
                else (
                    "قیمت و ظرفیت نهایی تأیید شد؛ برای مشاهده فاکتور و پرداخت "
                    "وارد پیگیری رزرو شوید."
                )
            )
            if payload.status == "approved"
            else (
                value.admin_note
                or (
                    "درخواست رزرو شما رد شد و بلیت‌های صادرشده حذف شدند؛ "
                    "برای جزئیات با پشتیبانی در ارتباط باشید."
                )
            )
        ),
        link="/account/operations/",
    )
    await session.commit()
    value = await BookingRepository(session).get_admin_booking(booking_id)
    return AdminBookingRead.model_validate(value)


@admin_router.post("/{booking_id}/confirm-payment", response_model=AdminBookingRead)
async def confirm_payment(
    booking_id: int,
    payload: BookingPaymentConfirmation,
    session: DatabaseSession,
    admin: CurrentAdmin,
    _trusted_origin: TrustedOrigin,
) -> AdminBookingRead:
    """Issue tickets after offline settlement or verified gateway payment."""
    require_reviewer(admin)
    repository = BookingRepository(session)
    value = await repository.get_admin_booking(booking_id, for_update=True)
    if value is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if value.payment_method == "agency_credit":
        raise HTTPException(
            status_code=409,
            detail="رزرو اعتباری آژانس هنگام تأیید رزرو به‌صورت خودکار تسویه می‌شود",
        )
    if value.status not in {"approved", "paid"}:
        raise HTTPException(
            status_code=409, detail="only approved bookings can be settled"
        )
    previous_status = value.status
    if previous_status == "paid":
        verified_payment = await session.scalar(
            select(PaymentIntent.id)
            .where(
                PaymentIntent.crm_contract_number == value.booking_number,
                PaymentIntent.status.in_(
                    (
                        PaymentStatus.PAID,
                        PaymentStatus.CRM_SYNC_PENDING,
                        PaymentStatus.CRM_SYNCED,
                    )
                ),
            )
            .limit(1)
        )
        if verified_payment is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="پرداخت درگاه برای این رزرو تأیید نشده است",
            )
        value.checkout_step = "fulfillment"
        value.admin_note = (
            payload.admin_note.strip()
            if payload.admin_note and payload.admin_note.strip()
            else value.admin_note
        )
        session.add(
            BookingStatusEvent(
                booking_id=value.id,
                actor_type="admin",
                actor_id=admin.id,
                event_type="ticket_issuance_confirmed_by_admin",
                from_status="paid",
                to_status="paid",
                note=value.admin_note,
                payload={"paymentIntentId": verified_payment},
            )
        )
    else:
        value.status = "paid"
        value.paid_at = datetime.now(UTC)
        value.checkout_step = "paid"
        value.admin_note = (
            payload.admin_note.strip()
            if payload.admin_note and payload.admin_note.strip()
            else value.admin_note
        )
        session.add(
            BookingStatusEvent(
                booking_id=value.id,
                actor_type="admin",
                actor_id=admin.id,
                event_type="payment_confirmed_by_admin",
                from_status="approved",
                to_status="paid",
                note=value.admin_note,
                payload={"paymentMethod": value.payment_method},
            )
        )
        settled_amount = value.payable_now_amount or value.total_amount
        if settled_amount is not None and settled_amount > 0:
            session.add(
                PaymentIntent(
                    customer_user_id=value.customer_id,
                    crm_contract_number=value.booking_number,
                    amount=settled_amount,
                    currency=value.currency,
                    status=PaymentStatus.PAID,
                    provider="manual",
                    provider_reference=f"MANUAL-{value.booking_number}",
                    verified_at=datetime.now(UTC),
                )
            )
    try:
        await issue_booking_tickets(session, value.id)
        await OperationsRepository(session).create_notification(
            value.customer_id,
            notification_type="booking",
            title="پرداخت تأیید شد و بلیت‌ها صادر شدند",
            body="بلیت‌ها و فاکتور نهایی از صفحه پیگیری رزرو در دسترس هستند.",
            link="/account/operations/",
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    value = await repository.get_admin_booking(booking_id)
    return AdminBookingRead.model_validate(value)
