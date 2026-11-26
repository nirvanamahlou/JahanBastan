"""Public customer registration, authentication, and account dashboard endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from secrets import randbelow
from smtplib import SMTPException
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies.auth import CurrentCustomer, DatabaseSession, TrustedOrigin
from app.core.config import get_settings
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.repositories.agencies import AgencyRepository
from app.repositories.bookings import BookingRepository
from app.repositories.carts import CartLifecycleRepository
from app.repositories.customer_accounts import (
    AvailabilityAlertRepository,
    CustomerPasswordResetTokenRepository,
    CustomerSessionRepository,
    CustomerSmsLoginCodeRepository,
    CustomerUserRepository,
)
from app.repositories.customer_commerce import CustomerCommerceRepository
from app.schemas.account import (
    AgencyProfileRead,
    AvailabilityAlertCreate,
    AvailabilityAlertRead,
    CartConsultationCreate,
    CartItemCreate,
    CartItemRead,
    CartPriceAcceptance,
    CartSummaryRead,
    CustomerAccountUpdate,
    CustomerAuthentication,
    CustomerDashboard,
    CustomerInsuranceRead,
    CustomerInsuranceWrite,
    CustomerLogin,
    CustomerOrderRead,
    CustomerPassengerRead,
    CustomerPassengerWrite,
    CustomerRegistration,
    CustomerSmsLoginRequest,
    CustomerSmsLoginVerify,
    CustomerSupportRequestCreate,
    CustomerSupportRequestRead,
    CustomerWalletRead,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    SavedTourRead,
)
from app.services.online_sales import require_online_sales_enabled
from app.services.password_reset_email import (
    deliver_password_reset_email,
    smtp_is_configured,
)
from app.services.sms_provider import (
    SmsProviderError,
    request_login_code,
    request_password_reset_sms,
    sms_provider_is_configured,
    verify_login_code,
)

router = APIRouter(prefix="/account", tags=["customer-authentication"])
settings = get_settings()
logger = logging.getLogger(__name__)


def set_customer_cookie(
    response: Response,
    *,
    token: str,
    expires_at: datetime,
    ttl_minutes: int,
) -> None:
    response.set_cookie(
        key=settings.CUSTOMER_SESSION_COOKIE_NAME,
        value=token,
        max_age=ttl_minutes * 60,
        expires=expires_at,
        httponly=True,
        secure=settings.APP_ENV in {"staging", "production"},
        samesite="lax",
        path="/",
    )


async def issue_customer_session(
    *,
    user_id: int,
    remember_me: bool,
    response: Response,
    session: DatabaseSession,
) -> None:
    ttl_minutes = (
        settings.CUSTOMER_SESSION_TTL_MINUTES
        if remember_me
        else settings.CUSTOMER_SESSION_SHORT_TTL_MINUTES
    )
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=ttl_minutes)
    raw_token = generate_session_token()
    await CustomerSessionRepository(session).create(
        user_id=user_id,
        token_hash=hash_session_token(raw_token),
        expires_at=expires_at,
    )
    set_customer_cookie(
        response,
        token=raw_token,
        expires_at=expires_at,
        ttl_minutes=ttl_minutes,
    )


def serialize_saved_tour(item: object) -> SavedTourRead:
    tour = item.tour
    return SavedTourRead(
        id=item.id,
        tour_id=item.tour_id,
        title=tour.title,
        slug=tour.slug,
        image_id=tour.image_id,
        price_amount=tour.price_amount,
        currency=tour.currency,
        created_at=item.created_at,
    )


def serialize_order(intent: object) -> CustomerOrderRead:
    return CustomerOrderRead(
        id=int(intent.id),
        order_number=intent.crm_contract_number,
        title="پرداخت سفارش",
        amount=intent.amount,
        currency=intent.currency,
        status=str(intent.status),
        created_at=intent.created_at,
    )


def _booking_title(booking: object) -> str:
    titles = [
        str(item.title_snapshot).strip()
        for item in booking.items
        if getattr(item, "title_snapshot", None)
    ]
    if not titles:
        return "رزرو سفر"
    if len(titles) == 1:
        return titles[0]
    return f"{titles[0]} و {len(titles) - 1} مورد دیگر"


def serialize_booking_order(booking: object) -> CustomerOrderRead:
    service_items = [
        {
            "title": str(item.title_snapshot).strip() or "رزرو سفر",
            "details": (
                str(item.details_snapshot).strip()
                if getattr(item, "details_snapshot", None)
                else None
            ),
        }
        for item in booking.items
    ]
    return CustomerOrderRead(
        id=int(booking.id),
        order_number=booking.booking_number,
        title=_booking_title(booking),
        amount=booking.total_amount or Decimal(0),
        currency=booking.currency,
        status=booking.status,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        service_items=service_items,
        passenger_count=len(booking.passenger_details or []),
        source="booking",
        payment_expires_at=booking.payment_expires_at,
        tickets_issued=bool(booking.tickets),
    )


def _payment_orders_without_booking_duplicates(
    orders: list[object], bookings: list[object]
) -> list[object]:
    """Keep payments without a booking, while rendering each booking only once."""
    booking_numbers = {str(booking.booking_number) for booking in bookings}
    return [
        order
        for order in orders
        if str(order.crm_contract_number) not in booking_numbers
    ]


@router.post(
    "/register",
    response_model=CustomerAuthentication,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: CustomerRegistration,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerAuthentication:
    repository = CustomerUserRepository(session)
    if await repository.get_by_email(str(payload.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    try:
        user = await repository.create(
            email=str(payload.email),
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            account_type=payload.account_type,
        )
        if payload.agency is not None:
            await AgencyRepository(session).create_profile(
                customer_id=user.id,
                **payload.agency.model_dump(by_alias=False),
            )
        await CustomerCommerceRepository(session).ensure_wallet(user.id)
        await issue_customer_session(
            user_id=user.id,
            remember_me=payload.remember_me,
            response=response,
            session=session,
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "email already registered",
        ) from exc
    await session.refresh(user)
    return CustomerAuthentication(user=user)


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_password_reset(
    payload: PasswordResetRequest,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> PasswordResetRequestResponse:
    """Create a single-use reset token without revealing account existence."""
    generic_response = PasswordResetRequestResponse(
        message="If the account exists, recovery instructions have been sent."
    )
    email_available = smtp_is_configured(settings)
    sms_available = sms_provider_is_configured(settings)
    if settings.APP_ENV in {"staging", "production"} and not (
        email_available or sms_available
    ):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "password reset delivery is not configured",
        )
    customer_repository = CustomerUserRepository(session)
    user = await customer_repository.get_by_email(str(payload.email))
    if user is None or not user.is_active:
        return generic_response

    now = datetime.now(UTC)
    raw_token = generate_session_token()
    reset_url = (
        f"{settings.PUBLIC_SITE_URL.rstrip('/')}/account/reset-password/"
        f"?token={raw_token}"
    )
    reset_tokens = CustomerPasswordResetTokenRepository(session)
    await reset_tokens.invalidate_active_for_customer(user.id)
    await reset_tokens.create(
        customer_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES),
    )

    delivered = False
    if email_available:
        try:
            delivered = await deliver_password_reset_email(
                settings=settings,
                recipient=user.email,
                reset_url=reset_url,
            )
        except (OSError, SMTPException):
            # A configured SMS channel can still deliver the same reset link.
            delivered = False

    if sms_available and user.phone:
        try:
            await request_password_reset_sms(settings, user.phone, reset_url)
            delivered = True
        except SmsProviderError:
            # Never disclose the failed channel to an unauthenticated visitor.
            pass

    if not delivered and settings.APP_ENV in {"staging", "production"}:
        await session.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "password reset delivery is temporarily unavailable",
        )
    await session.commit()

    # Local Docker setup can still expose the one-time link for testing.
    if settings.APP_ENV in {"development", "test"}:
        return PasswordResetRequestResponse(
            message="A local test reset link was created.", reset_url=reset_url
        )
    return generic_response


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Set a new password from a valid reset token and revoke old sessions."""
    reset_tokens = CustomerPasswordResetTokenRepository(session)
    reset_token = await reset_tokens.get_active(hash_session_token(payload.token))
    if reset_token is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "invalid or expired reset token"
        )

    user = await CustomerUserRepository(session).get_by_id(reset_token.customer_user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "invalid or expired reset token"
        )

    user.password_hash = hash_password(payload.password)
    user.failed_login_count = 0
    user.locked_until = None
    await reset_tokens.invalidate_active_for_customer(user.id)
    await CustomerSessionRepository(session).revoke_all_for_customer(user.id)
    await session.commit()
    response.delete_cookie(
        key=settings.CUSTOMER_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="lax",
    )


@router.post("/sms/request", status_code=status.HTTP_202_ACCEPTED)
async def request_sms_login(
    payload: CustomerSmsLoginRequest,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> dict[str, str | int]:
    """Request a one-time login code without exposing account existence."""
    code: str | None = None
    if settings.SMS_PROVIDER == "sms_ir":
        code = f"{randbelow(1_000_000):06d}"
        codes = CustomerSmsLoginCodeRepository(session)
        await codes.invalidate_active_for_phone(payload.phone)
        await codes.create(
            phone=payload.phone,
            code_hash=hash_password(code),
            expires_at=datetime.now(UTC)
            + timedelta(seconds=settings.SMS_OTP_TTL_SECONDS),
        )
    try:
        await request_login_code(settings, payload.phone, code)
        await session.commit()
    except SmsProviderError as exc:
        logger.warning(
            "SMS login delivery is unavailable (provider=%s, reason=%s)",
            settings.SMS_PROVIDER,
            str(exc),
        )
        await session.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SMS login is temporarily unavailable",
        ) from exc
    return {
        "message": "If the phone is valid, a login code has been sent.",
        "expiresIn": settings.SMS_OTP_TTL_SECONDS,
    }


@router.post("/sms/verify", response_model=CustomerAuthentication)
async def verify_sms_login(
    payload: CustomerSmsLoginVerify,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerAuthentication:
    """Verify a one-time code and create the phone account on first login."""
    if settings.SMS_PROVIDER == "sms_ir":
        codes = CustomerSmsLoginCodeRepository(session)
        stored_code = await codes.get_active(payload.phone)
        verified = bool(
            stored_code
            and stored_code.attempts < settings.SMS_OTP_MAX_ATTEMPTS
            and verify_password(payload.code, stored_code.code_hash)
        )
        if stored_code is not None:
            if verified:
                await codes.consume(stored_code)
            else:
                await codes.register_failed_attempt(
                    stored_code, max_attempts=settings.SMS_OTP_MAX_ATTEMPTS
                )
            await session.commit()
    else:
        try:
            verified = await verify_login_code(settings, payload.phone, payload.code)
        except SmsProviderError as exc:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "SMS verification is temporarily unavailable",
            ) from exc
    if not verified:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired SMS code")

    repository = CustomerUserRepository(session)
    user = await repository.get_by_phone(payload.phone)
    if user is None:
        phone_digits = payload.phone.removeprefix("+")
        user = await repository.create(
            email=f"phone-{phone_digits}@jahanbastan.ir",
            full_name="",
            password_hash=hash_password(generate_session_token()),
        )
        user.phone = payload.phone
        await CustomerCommerceRepository(session).ensure_wallet(user.id)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "customer account is inactive")

    user.last_login_at = datetime.now(UTC)
    await issue_customer_session(
        user_id=user.id,
        remember_me=payload.remember_me,
        response=response,
        session=session,
    )
    await session.commit()
    await session.refresh(user)
    return CustomerAuthentication(user=user)


@router.post("/login", response_model=CustomerAuthentication)
async def login(
    payload: CustomerLogin,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerAuthentication:
    repository = CustomerUserRepository(session)
    user = await repository.get_by_email(str(payload.email))
    password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    password_valid = verify_password(payload.password, password_hash)
    now = datetime.now(UTC)

    if user is not None and user.locked_until and user.locked_until > now:
        retry_after = max(1, int((user.locked_until - now).total_seconds()))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "login temporarily locked",
            headers={"Retry-After": str(retry_after)},
        )
    if (
        user is None
        or not password_valid
        or not user.is_active
        or user.account_type != payload.account_type
    ):
        if user is not None:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.CUSTOMER_LOGIN_MAX_ATTEMPTS:
                user.locked_until = now + timedelta(
                    minutes=settings.CUSTOMER_LOCKOUT_MINUTES
                )
                user.failed_login_count = 0
            await session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    await issue_customer_session(
        user_id=user.id,
        remember_me=payload.remember_me,
        response=response,
        session=session,
    )
    await session.commit()
    await session.refresh(user)
    return CustomerAuthentication(user=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    token = request.cookies.get(settings.CUSTOMER_SESSION_COOKIE_NAME)
    if token:
        await CustomerSessionRepository(session).revoke(hash_session_token(token))
        await session.commit()
    response.delete_cookie(
        settings.CUSTOMER_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="lax",
    )


@router.get("/me", response_model=CustomerAuthentication)
async def get_me(current_customer: CurrentCustomer) -> CustomerAuthentication:
    return CustomerAuthentication(user=current_customer)


@router.patch("/me", response_model=CustomerAuthentication)
async def update_me(
    payload: CustomerAccountUpdate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerAuthentication:
    provided_fields = payload.model_fields_set
    customer = await CustomerCommerceRepository(session).update_profile(
        current_customer,
        full_name=payload.full_name,
        phone=(payload.phone if "phone" in provided_fields else current_customer.phone),
        buyer_mobile=payload.buyer_mobile
        if "buyer_mobile" in provided_fields
        else current_customer.buyer_mobile,
        landline=payload.landline
        if "landline" in provided_fields
        else current_customer.landline,
        postal_code=payload.postal_code
        if "postal_code" in provided_fields
        else current_customer.postal_code,
        emergency_phone=(
            payload.emergency_phone
            if "emergency_phone" in provided_fields
            else current_customer.emergency_phone
        ),
        national_code=(
            payload.national_code
            if "national_code" in provided_fields
            else current_customer.national_code
        ),
        birth_date=(
            payload.birth_date
            if "birth_date" in provided_fields
            else current_customer.birth_date
        ),
        address=(
            payload.address
            if "address" in provided_fields
            else current_customer.address
        ),
        bank_iban=(
            payload.bank_iban
            if "bank_iban" in provided_fields
            else current_customer.bank_iban
        ),
        bank_account_number=(
            payload.bank_account_number
            if "bank_account_number" in provided_fields
            else current_customer.bank_account_number
        ),
        bank_card_number=payload.bank_card_number,
    )
    await session.commit()
    await session.refresh(customer)
    return CustomerAuthentication(user=customer)


@router.get("/wallet", response_model=CustomerWalletRead)
async def get_wallet(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> CustomerWalletRead:
    wallet = await CustomerCommerceRepository(session).ensure_wallet(
        current_customer.id
    )
    await session.commit()
    return CustomerWalletRead.model_validate(wallet)


@router.get("/dashboard", response_model=CustomerDashboard)
async def get_dashboard(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> CustomerDashboard:
    repository = CustomerCommerceRepository(session)
    wallet = await repository.ensure_wallet(current_customer.id)
    agency = await AgencyRepository(session).get_for_customer(current_customer.id)
    cart_items = await repository.get_cart_items(current_customer.id)
    saved_tours = await repository.get_saved_tours(current_customer.id)
    orders = await repository.list_orders(
        current_customer.id,
        query=None,
        payment_status=None,
        date_from=None,
        date_to=None,
        limit=50,
    )
    bookings = await BookingRepository(session).list_customer_bookings(
        current_customer.id
    )
    recent_orders = sorted(
        [*_payment_orders_without_booking_duplicates(orders, bookings), *bookings],
        key=lambda item: (item.created_at, item.id),
        reverse=True,
    )[:5]
    await session.commit()
    return CustomerDashboard(
        user=current_customer,
        wallet=CustomerWalletRead.model_validate(wallet),
        agency=(AgencyProfileRead.model_validate(agency) if agency else None),
        cart_items=cart_items,
        saved_tours=[serialize_saved_tour(item) for item in saved_tours],
        recent_orders=[
            serialize_booking_order(order)
            if hasattr(order, "booking_number")
            else serialize_order(order)
            for order in recent_orders
        ],
    )


@router.get("/agency", response_model=AgencyProfileRead | None)
async def get_agency_profile(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> AgencyProfileRead | None:
    profile = await AgencyRepository(session).get_for_customer(current_customer.id)
    return AgencyProfileRead.model_validate(profile) if profile else None


@router.get("/orders", response_model=list[CustomerOrderRead])
async def get_orders(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    query: str | None = Query(default=None, max_length=128),
    payment_status: str | None = Query(default=None, max_length=32),
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[CustomerOrderRead]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid date range")
    orders = await CustomerCommerceRepository(session).list_orders(
        current_customer.id,
        query=query,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
    )
    bookings = await BookingRepository(session).list_customer_bookings(
        current_customer.id
    )
    matching_bookings = [
        booking
        for booking in bookings
        if (
            (not query or query.strip().casefold() in booking.booking_number.casefold())
            and (not payment_status or booking.status == payment_status)
            and (not date_from or booking.created_at.date() >= date_from)
            and (not date_to or booking.created_at.date() <= date_to)
        )
    ]
    customer_orders = sorted(
        [
            *_payment_orders_without_booking_duplicates(orders, bookings),
            *matching_bookings,
        ],
        key=lambda item: (item.created_at, item.id),
        reverse=True,
    )
    return [
        serialize_booking_order(order)
        if hasattr(order, "booking_number")
        else serialize_order(order)
        for order in customer_orders
    ]


@router.delete("/orders/{source}/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_customer_order(
    source: Literal["booking", "payment"],
    order_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Hide an order from its owner's travel history without deleting business data."""
    if source == "booking":
        archived = await BookingRepository(session).archive_customer_booking(
            current_customer.id, order_id
        )
    else:
        archived = await CustomerCommerceRepository(session).archive_order(
            current_customer.id, order_id
        )
    if not archived:
        raise HTTPException(status_code=404, detail="order not found")
    await session.commit()


@router.get("/passengers", response_model=list[CustomerPassengerRead])
async def get_passengers(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    query: str | None = Query(default=None, max_length=120),
) -> list[CustomerPassengerRead]:
    return await CustomerCommerceRepository(session).list_passengers(
        current_customer.id, query
    )


@router.post(
    "/passengers",
    response_model=CustomerPassengerRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_passenger(
    payload: CustomerPassengerWrite,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerPassengerRead:
    try:
        passenger = await CustomerCommerceRepository(session).create_passenger(
            current_customer.id, **payload.model_dump(by_alias=False)
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "a passenger with this national code already exists",
        ) from exc
    await session.refresh(passenger)
    return CustomerPassengerRead.model_validate(passenger)


@router.delete("/passengers/{passenger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_passenger(
    passenger_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    if not await CustomerCommerceRepository(session).delete_passenger(
        current_customer.id, passenger_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "passenger not found")
    await session.commit()


@router.get("/insurances", response_model=list[CustomerInsuranceRead])
async def get_insurances(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[CustomerInsuranceRead]:
    return await CustomerCommerceRepository(session).list_insurances(
        current_customer.id
    )


@router.post(
    "/insurances",
    response_model=CustomerInsuranceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_insurance(
    payload: CustomerInsuranceWrite,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerInsuranceRead:
    insurance = await CustomerCommerceRepository(session).create_insurance(
        current_customer.id, **payload.model_dump(by_alias=False)
    )
    await session.commit()
    await session.refresh(insurance)
    return CustomerInsuranceRead.model_validate(insurance)


@router.delete("/insurances/{insurance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insurance(
    insurance_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    if not await CustomerCommerceRepository(session).delete_insurance(
        current_customer.id, insurance_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "insurance not found")
    await session.commit()


@router.get("/support-requests", response_model=list[CustomerSupportRequestRead])
async def get_support_requests(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[CustomerSupportRequestRead]:
    return await CustomerCommerceRepository(session).list_support_requests(
        current_customer.id
    )


@router.post(
    "/support-requests",
    response_model=CustomerSupportRequestRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_support_request(
    payload: CustomerSupportRequestCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerSupportRequestRead:
    support_request = await CustomerCommerceRepository(session).create_support_request(
        current_customer.id, payload.subject, payload.message
    )
    await session.commit()
    await session.refresh(support_request, attribute_names=["messages"])
    return CustomerSupportRequestRead.model_validate(support_request)


@router.get("/availability-alerts", response_model=list[AvailabilityAlertRead])
async def get_availability_alerts(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[AvailabilityAlertRead]:
    return await AvailabilityAlertRepository(session).list_for_customer(
        current_customer.id
    )


@router.post(
    "/availability-alerts",
    response_model=AvailabilityAlertRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_availability_alert(
    payload: AvailabilityAlertCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> AvailabilityAlertRead:
    alert = await AvailabilityAlertRepository(session).create_or_reactivate(
        customer_id=current_customer.id,
        service_type=payload.service_type,
        origin=payload.origin.strip(),
        destination=payload.destination.strip(),
        departure_date=payload.departure_date,
    )
    await session.commit()
    await session.refresh(alert)
    return AvailabilityAlertRead.model_validate(alert)


@router.get("/cart/summary", response_model=CartSummaryRead | None)
async def get_cart_summary(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> CartSummaryRead | None:
    cart = await CartLifecycleRepository(session).get_summary(current_customer.id)
    return CartSummaryRead.model_validate(cart) if cart is not None else None


@router.post("/cart/refresh", response_model=list[CartItemRead])
async def refresh_cart(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> list[CartItemRead]:
    items = await CartLifecycleRepository(session).refresh(current_customer.id)
    await session.commit()
    return [CartItemRead.model_validate(item) for item in items]


@router.post("/cart/accept-price", response_model=list[CartItemRead])
async def accept_cart_price_changes(
    payload: CartPriceAcceptance,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> list[CartItemRead]:
    items = await CartLifecycleRepository(session).accept_price_changes(
        current_customer.id, payload.item_ids
    )
    await session.commit()
    return [CartItemRead.model_validate(item) for item in items]


@router.post("/cart/consultation", status_code=status.HTTP_204_NO_CONTENT)
async def request_cart_consultation(
    payload: CartConsultationCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    await CartLifecycleRepository(session).request_consultation(
        current_customer.id, payload.message
    )
    await session.commit()


@router.get("/cart", response_model=list[CartItemRead])
async def get_cart(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[CartItemRead]:
    return [
        CartItemRead.model_validate(item)
        for item in await CartLifecycleRepository(session).get_items(
            current_customer.id
        )
    ]


@router.post("/cart", response_model=CartItemRead, status_code=status.HTTP_201_CREATED)
async def add_cart_item(
    payload: CartItemCreate,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CartItemRead:
    await require_online_sales_enabled(session)
    item = await CartLifecycleRepository(session).add_item(
        current_customer.id,
        item_type=payload.item_type,
        tour_id=payload.tour_id,
        tour_departure_id=payload.tour_departure_id,
        tour_hotel_price_id=payload.tour_hotel_price_id,
        combined_departure_price_id=payload.combined_departure_price_id,
        room_selection=payload.room_selection,
        travel_service_id=payload.travel_service_id,
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "purchasable item not found")
    await session.commit()
    return CartItemRead.model_validate(item)


@router.delete("/cart/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cart_item(
    item_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    if not await CartLifecycleRepository(session).remove_item(
        current_customer.id, item_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "cart item not found")
    await session.commit()


@router.get("/saved-tours", response_model=list[SavedTourRead])
async def get_saved_tours(
    current_customer: CurrentCustomer,
    session: DatabaseSession,
) -> list[SavedTourRead]:
    items = await CustomerCommerceRepository(session).get_saved_tours(
        current_customer.id
    )
    return [serialize_saved_tour(item) for item in items]


@router.post(
    "/saved-tours/{tour_id}",
    response_model=SavedTourRead,
    status_code=status.HTTP_201_CREATED,
)
async def save_tour(
    tour_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> SavedTourRead:
    repository = CustomerCommerceRepository(session)
    item = await repository.save_tour(current_customer.id, tour_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "available tour not found")
    await session.commit()
    saved_items = await repository.get_saved_tours(current_customer.id)
    saved_item = next(saved for saved in saved_items if saved.tour_id == tour_id)
    return serialize_saved_tour(saved_item)


@router.delete("/saved-tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_saved_tour(
    tour_id: int,
    current_customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    if not await CustomerCommerceRepository(session).remove_saved_tour(
        current_customer.id, tour_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "saved tour not found")
    await session.commit()
