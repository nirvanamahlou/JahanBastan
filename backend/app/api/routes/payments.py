"""Payment entry points with server-derived amounts and provider verification."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import CurrentCustomer, DatabaseSession, TrustedOrigin
from app.core.config import get_settings
from app.models import BookingRequest, BookingStatus, PaymentIntent, PaymentStatus
from app.models.checkout import BookingStatusEvent
from app.repositories.bookings import BookingRepository
from app.repositories.operations import OperationsRepository
from app.schemas.payment import (
    PaymentConfiguration,
    PaymentIntentCreate,
    PaymentIntentRead,
    WalletTopUpCreate,
    WalletTopUpRead,
)
from app.services.payment_provider import (
    PaymentProviderError,
    create_gateway_request,
    payment_provider_is_configured,
    verify_gateway_payment,
)
from app.services.wallet_topups import (
    create_wallet_topup as create_wallet_topup_payment,
)
from app.services.wallet_topups import (
    handle_wallet_topup_callback,
)

router = APIRouter(prefix="/payments", tags=["payments"])
settings = get_settings()


async def _expire_booking_hold(
    session: DatabaseSession,
    booking: BookingRequest,
    reason: str,
    *,
    payment_intent_id: int | None = None,
) -> None:
    """Release a local hold once when a payable booking cannot be completed."""
    if booking.status not in {BookingStatus.APPROVED, "approved"}:
        return
    repository = BookingRepository(session)
    await repository.release_booking_capacity(booking)
    await repository.release_booking_discount(booking)
    booking.status = BookingStatus.EXPIRED
    booking.checkout_step = "payment_failed"
    booking.payment_expires_at = datetime.now(UTC)
    session.add(
        BookingStatusEvent(
            booking_id=booking.id,
            actor_type="system",
            actor_id=None,
            event_type="payment_failed_hold_released",
            from_status="approved",
            to_status="expired",
            note=reason,
            payload={"paymentIntentId": payment_intent_id},
        )
    )
    await OperationsRepository(session).create_notification(
        booking.customer_id,
        notification_type="booking",
        title="پرداخت ناموفق بود؛ ظرفیت آزاد شد",
        body=(
            "پرداخت تأیید نشد و ظرفیت موقت آزاد شد. "
            "برای رزرو مجدد، درخواست تازه ثبت کنید."
        ),
        link="/cart/",
    )


async def _release_failed_booking_hold(
    session: DatabaseSession,
    intent: PaymentIntent,
    reason: str,
) -> None:
    """Find the booking tied to a failed gateway attempt and release its hold."""
    booking = await session.scalar(
        select(BookingRequest)
        .options(selectinload(BookingRequest.items))
        .where(
            BookingRequest.customer_id == intent.customer_user_id,
            BookingRequest.booking_number == intent.crm_contract_number,
        )
        .with_for_update()
    )
    if booking is not None:
        await _expire_booking_hold(
            session,
            booking,
            reason,
            payment_intent_id=intent.id,
        )


@router.get("/configuration", response_model=PaymentConfiguration)
async def payment_configuration() -> PaymentConfiguration:
    """Expose availability only when every required provider setting exists."""
    enabled = payment_provider_is_configured(settings)
    return PaymentConfiguration(
        enabled=enabled,
        provider=settings.PAYMENT_PROVIDER if enabled else None,
        message=""
        if enabled
        else "پرداخت آنلاین تا تکمیل تنظیمات امن درگاه غیرفعال است.",
    )


@router.post(
    "/intents",
    response_model=PaymentIntentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_intent(
    payload: PaymentIntentCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> PaymentIntentRead:
    """Create a gateway attempt using the booking amount stored on the server."""
    booking = await session.scalar(
        select(BookingRequest).where(
            BookingRequest.customer_id == current_customer.id,
            BookingRequest.booking_number == payload.crm_contract_number,
        )
    )
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "booking not found")
    if booking.payment_expires_at and booking.payment_expires_at <= datetime.now(UTC):
        expired_booking = await session.scalar(
            select(BookingRequest)
            .options(selectinload(BookingRequest.items))
            .where(BookingRequest.id == booking.id)
            .with_for_update()
        )
        if expired_booking is not None:
            await _expire_booking_hold(
                session,
                expired_booking,
                "Payment intent attempted after its expiry deadline.",
            )
            await session.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, "payment deadline has expired")
    if booking.status != BookingStatus.APPROVED:
        raise HTTPException(status.HTTP_409_CONFLICT, "booking is not payable")

    expected_amount = booking.payable_now_amount or booking.total_amount
    if expected_amount is None or expected_amount <= 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "booking payable amount is unavailable"
        )
    if booking.currency != "IRT":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "online checkout must be settled in toman"
        )
    if payload.amount != expected_amount or payload.currency != booking.currency:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "payment amount changed; reload the invoice before paying",
        )
    if not payment_provider_is_configured(settings):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "online payment is not configured",
        )

    pending = await session.scalar(
        select(PaymentIntent).where(
            PaymentIntent.customer_user_id == current_customer.id,
            PaymentIntent.crm_contract_number == booking.booking_number,
            PaymentIntent.status == PaymentStatus.GATEWAY_PENDING,
        )
    )
    if pending is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "a payment attempt is already pending"
        )

    intent = PaymentIntent(
        customer_user_id=current_customer.id,
        crm_contract_number=booking.booking_number,
        amount=expected_amount,
        currency=booking.currency,
        status=PaymentStatus.PENDING,
        provider=settings.PAYMENT_PROVIDER,
    )
    session.add(intent)
    await session.commit()
    await session.refresh(intent)

    try:
        gateway = await create_gateway_request(
            settings,
            reference=str(intent.id),
            amount=intent.amount,
            currency=intent.currency,
            description=payload.description
            or f"Jahan Bastan booking {booking.booking_number}",
        )
    except PaymentProviderError as exc:
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "gateway request failed"
        await _release_failed_booking_hold(session, intent, intent.failure_reason)
        await session.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "payment gateway is temporarily unavailable",
        ) from exc

    intent.provider_authority = gateway.authority
    intent.status = PaymentStatus.GATEWAY_PENDING
    await session.commit()
    await session.refresh(intent)
    return PaymentIntentRead.model_validate(intent).model_copy(
        update={"checkout_url": gateway.checkout_url}
    )


@router.post(
    "/wallet-topups",
    response_model=WalletTopUpRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_wallet_topup(
    payload: WalletTopUpCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> WalletTopUpRead:
    return await create_wallet_topup_payment(
        session,
        customer_id=current_customer.id,
        payload=payload,
        settings=settings,
    )


@router.get("/callback", include_in_schema=False)
async def payment_callback(
    session: DatabaseSession,
    authority: str = Query(min_length=3, max_length=160),
    gateway_status: str = Query(default="", alias="status", max_length=40),
) -> RedirectResponse:
    """Verify the gateway response server-to-server before marking a booking paid."""
    intent = await session.scalar(
        select(PaymentIntent).where(PaymentIntent.provider_authority == authority)
    )
    public_url = settings.PUBLIC_SITE_URL.rstrip("/")
    if intent is None:
        return RedirectResponse(f"{public_url}/payment/?status=failed", status_code=303)
    wallet_redirect = await handle_wallet_topup_callback(
        session,
        intent=intent,
        authority=authority,
        gateway_status=gateway_status,
        settings=settings,
    )
    if wallet_redirect is not None:
        return wallet_redirect

    if intent.status in {
        PaymentStatus.PAID,
        PaymentStatus.CRM_SYNC_PENDING,
        PaymentStatus.CRM_SYNCED,
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.REFUNDED,
    }:
        return RedirectResponse(
            f"{public_url}/payment/?status=paid&contract={intent.crm_contract_number}",
            status_code=303,
        )
    if gateway_status.lower() in {"cancelled", "canceled", "failed"}:
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "customer cancelled gateway payment"
        await _release_failed_booking_hold(session, intent, intent.failure_reason)
        await session.commit()
        return RedirectResponse(
            f"{public_url}/payment/?status=cancelled&contract={intent.crm_contract_number}",
            status_code=303,
        )

    try:
        verification = await verify_gateway_payment(
            settings,
            authority=authority,
            amount=intent.amount,
            currency=intent.currency,
        )
    except PaymentProviderError:
        return RedirectResponse(
            f"{public_url}/payment/?status=pending&contract={intent.crm_contract_number}",
            status_code=303,
        )
    if not verification.verified:
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "gateway verification rejected"
        await _release_failed_booking_hold(session, intent, intent.failure_reason)
        await session.commit()
        return RedirectResponse(
            f"{public_url}/payment/?status=failed&contract={intent.crm_contract_number}",
            status_code=303,
        )

    intent.status = PaymentStatus.PAID
    intent.provider_reference = verification.reference
    intent.verified_at = datetime.now(UTC)
    booking = await session.scalar(
        select(BookingRequest).where(
            BookingRequest.customer_id == intent.customer_user_id,
            BookingRequest.booking_number == intent.crm_contract_number,
        )
    )
    if booking is not None and booking.status not in {
        BookingStatus.APPROVED,
        "approved",
    }:
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "booking is no longer payable"
        await session.commit()
        return RedirectResponse(
            f"{public_url}/payment/?status=failed&contract={intent.crm_contract_number}",
            status_code=303,
        )
    if booking is not None:
        booking.status = BookingStatus.PAID
        booking.checkout_step = "payment_received"
        booking.paid_at = datetime.now(UTC)
        session.add(
            BookingStatusEvent(
                booking_id=booking.id,
                actor_type="system",
                actor_id=None,
                event_type="gateway_payment_verified",
                from_status="approved",
                to_status="paid",
                note="Gateway payment was verified and is awaiting admin confirmation.",
                payload={"paymentIntentId": intent.id, "provider": intent.provider},
            )
        )
        await OperationsRepository(session).create_notification(
            booking.customer_id,
            notification_type="booking",
            title="پرداخت ثبت شد؛ در انتظار تأیید پشتیبان",
            body=(
                "پرداخت شما توسط درگاه تأیید شد. پس از تأیید نهایی پشتیبان، "
                "بلیت‌ها در صفحه پیگیری رزرو در دسترس خواهند بود."
            ),
            link="/account/operations/",
        )
    await session.commit()
    return RedirectResponse(
        f"{public_url}/payment/?status=received&contract={intent.crm_contract_number}",
        status_code=303,
    )
