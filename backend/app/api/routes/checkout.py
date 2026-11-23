"""Connected customer and administrator checkout endpoints."""

from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import select

from app.api.dependencies.auth import (
    AdminManager,
    CurrentCustomer,
    DatabaseSession,
    TrustedOrigin,
)
from app.core.config import get_settings
from app.models import BookingRequest, CustomerUser, SiteSetting
from app.repositories.checkout import CheckoutRepository
from app.schemas.checkout import (
    BookingDocumentRead,
    CheckoutConfiguration,
    DocumentRequirementRead,
    DocumentRequirementWrite,
    DocumentReview,
    InstallmentLine,
    InstallmentPaymentReview,
    InstallmentQuote,
    InstallmentQuoteRequest,
)
from app.services.checkout import calculate_installment_quote, store_private_document
from app.services.checkout_pdf import create_installment_schedule_pdf
from app.services.currency import exchange_rates_from_links
from app.services.private_storage import private_download_response

customer_router = APIRouter(prefix="/account/checkout", tags=["account-checkout"])
admin_router = APIRouter(prefix="/admin/checkout", tags=["admin-checkout"])


def _decimal_setting(links: dict[str, str], key: str, default: str) -> Decimal:
    try:
        return Decimal(links.get(key, default))
    except Exception:
        return Decimal(default)


async def _configuration(session: DatabaseSession) -> CheckoutConfiguration:
    settings = await session.get(SiteSetting, 1)
    links = settings.social_links if settings else {}
    requirements = await CheckoutRepository(session).list_requirements()
    max_months = max(3, min(12, int(links.get("installmentMaxMonths", "12"))))
    configured_minimum = _decimal_setting(
        links, "installmentMinDownPaymentPercent", "50"
    )
    minimum_down_payment = min(Decimal("100"), max(Decimal("50"), configured_minimum))
    configured_default = _decimal_setting(links, "installmentDownPaymentPercent", "50")
    default_down_payment = min(
        Decimal("100"), max(minimum_down_payment, configured_default)
    )
    exchange_rates = exchange_rates_from_links(links)
    return CheckoutConfiguration(
        cash_enabled=links.get("checkoutCashEnabled", "true") != "false",
        installment_enabled=links.get("checkoutInstallmentEnabled", "true") != "false",
        min_down_payment_percent=minimum_down_payment,
        default_down_payment_percent=default_down_payment,
        allowed_months=[item for item in (3, 6, 9, 12) if item <= max_months],
        monthly_fee_rate=_decimal_setting(links, "installmentFeeRate", "5"),
        max_credit_amount=_decimal_setting(
            links, "installmentMaxCreditAmount", "250000000"
        ),
        usd_to_irt=exchange_rates["USD"],
        eur_to_irt=exchange_rates["EUR"],
        terms_version=links.get("checkoutTermsVersion", "checkout-1405-01"),
        document_requirements=[
            DocumentRequirementRead.model_validate(item) for item in requirements
        ],
    )


@customer_router.get("/configuration", response_model=CheckoutConfiguration)
async def customer_configuration(
    _customer: CurrentCustomer, session: DatabaseSession
) -> CheckoutConfiguration:
    return await _configuration(session)


@customer_router.post("/installment-quote", response_model=InstallmentQuote)
async def quote_installments(
    payload: InstallmentQuoteRequest,
    _customer: CurrentCustomer,
    session: DatabaseSession,
) -> InstallmentQuote:
    configuration = await _configuration(session)
    if not configuration.installment_enabled:
        raise HTTPException(409, "خرید اقساطی غیرفعال است")
    if payload.months not in configuration.allowed_months:
        raise HTTPException(422, "تعداد اقساط انتخاب‌شده مجاز نیست")
    minimum = payload.total_amount * configuration.min_down_payment_percent / 100
    if payload.down_payment < minimum:
        raise HTTPException(422, "پیش‌پرداخت کمتر از حداقل مجاز است")
    if payload.total_amount - payload.down_payment > configuration.max_credit_amount:
        raise HTTPException(422, "مبلغ تأمین مالی بیشتر از سقف اعتبار است")
    if payload.monthly_fee_rate != configuration.monthly_fee_rate:
        raise HTTPException(422, "نرخ کارمزد با تنظیمات جاری مطابقت ندارد")
    return calculate_installment_quote(payload)


@customer_router.post(
    "/bookings/{booking_id}/installment-plan",
    response_model=list[InstallmentLine],
)
async def create_installment_plan(
    booking_id: int,
    payload: InstallmentQuoteRequest,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> list[InstallmentLine]:
    booking = await session.scalar(
        select(BookingRequest).where(
            BookingRequest.id == booking_id,
            BookingRequest.customer_id == customer.id,
        )
    )
    if booking is None:
        raise HTTPException(404, "سفارش پیدا نشد")
    if booking.installment_months is not None:
        raise HTTPException(409, "برنامه اقساط قبلاً ثبت شده است")
    if booking.total_amount and payload.total_amount != booking.total_amount:
        raise HTTPException(422, "مبلغ برنامه اقساط با مبلغ سفارش یکسان نیست")
    quote = await quote_installments(payload, customer, session)
    repository = CheckoutRepository(session)
    await repository.apply_installment_plan(booking, quote)
    repository.add_event(
        booking_id=booking.id,
        actor_type="customer",
        actor_id=customer.id,
        event_type="installment_plan_created",
        payload={"months": quote.months, "downPayment": str(quote.down_payment)},
    )
    await session.commit()
    return quote.schedule


@customer_router.get(
    "/bookings/{booking_id}/installments", response_model=list[InstallmentLine]
)
async def customer_installments(
    booking_id: int, customer: CurrentCustomer, session: DatabaseSession
) -> list[InstallmentLine]:
    booking = await session.scalar(
        select(BookingRequest.id).where(
            BookingRequest.id == booking_id,
            BookingRequest.customer_id == customer.id,
        )
    )
    if booking is None:
        raise HTTPException(404, "سفارش پیدا نشد")
    rows = await CheckoutRepository(session).list_installments(booking_id)
    return [InstallmentLine.model_validate(item) for item in rows]


@customer_router.get("/bookings/{booking_id}/installments.pdf")
async def download_installment_schedule(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
) -> StreamingResponse:
    booking = await session.scalar(
        select(BookingRequest).where(
            BookingRequest.id == booking_id,
            BookingRequest.customer_id == customer.id,
        )
    )
    if booking is None:
        raise HTTPException(404, "سفارش پیدا نشد")
    if booking.payment_method != "installment":
        raise HTTPException(409, "این سفارش برنامه اقساط ندارد")
    installments = await CheckoutRepository(session).list_installments(booking_id)
    if not installments:
        raise HTTPException(409, "برنامه اقساط هنوز ثبت نشده است")
    content = await create_installment_schedule_pdf(booking, installments)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="installments-{booking.booking_number}.pdf"'
            )
        },
    )


@customer_router.post(
    "/bookings/{booking_id}/documents",
    response_model=BookingDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_booking_document(
    booking_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _origin: TrustedOrigin,
    file: Annotated[UploadFile, File()],
    requirement_id: Annotated[int, Form(alias="requirementId")],
    passenger_index: Annotated[int | None, Form(alias="passengerIndex")] = None,
) -> BookingDocumentRead:
    booking = await session.scalar(
        select(BookingRequest).where(
            BookingRequest.id == booking_id,
            BookingRequest.customer_id == customer.id,
        )
    )
    if booking is None:
        raise HTTPException(404, "سفارش پیدا نشد")
    repository = CheckoutRepository(session)
    if passenger_index is not None and not 0 <= passenger_index < len(
        booking.passenger_details or []
    ):
        raise HTTPException(422, "مسافر انتخاب‌شده برای این سفارش معتبر نیست")
    requirement = await repository.get_requirement(requirement_id)
    if requirement is None or not requirement.is_active:
        raise HTTPException(404, "نوع مدرک پیدا نشد")
    key, mime, size = await store_private_document(
        file,
        allowed_extensions=requirement.allowed_extensions,
        max_bytes=requirement.max_bytes,
    )
    document = await repository.add_document(
        booking_id=booking_id,
        customer_id=customer.id,
        requirement_id=requirement.id,
        passenger_index=passenger_index,
        original_name=(file.filename or "document")[:255],
        storage_key=key,
        mime_type=mime,
        byte_size=size,
    )
    repository.add_event(
        booking_id=booking_id,
        actor_type="customer",
        actor_id=customer.id,
        event_type="document_uploaded",
        payload={"documentId": document.id, "requirementId": requirement.id},
    )
    await session.commit()
    await session.refresh(document)
    return _document_read(
        document,
        _passenger_name(booking.passenger_details, document.passenger_index),
    )


@customer_router.get(
    "/bookings/{booking_id}/documents", response_model=list[BookingDocumentRead]
)
async def customer_documents(
    booking_id: int, customer: CurrentCustomer, session: DatabaseSession
) -> list[BookingDocumentRead]:
    rows = await CheckoutRepository(session).list_customer_documents(
        customer.id, booking_id
    )
    return [BookingDocumentRead.model_validate(item) for item in rows]


async def _private_file(storage_key: str, filename: str, mime_type: str) -> Response:
    return await private_download_response(
        storage_key, filename, mime_type, get_settings()
    )


@customer_router.get("/documents/{document_id}/download")
async def customer_document_download(
    document_id: int, customer: CurrentCustomer, session: DatabaseSession
) -> FileResponse:
    document = await CheckoutRepository(session).get_customer_document(
        customer.id, document_id
    )
    if document is None:
        raise HTTPException(404, "مدرک پیدا نشد")
    return await _private_file(
        document.storage_key, document.original_name, document.mime_type
    )


@admin_router.get("/configuration", response_model=CheckoutConfiguration)
async def admin_configuration(
    _admin: AdminManager, session: DatabaseSession
) -> CheckoutConfiguration:
    return await _configuration(session)


@admin_router.get(
    "/document-requirements", response_model=list[DocumentRequirementRead]
)
async def list_document_requirements(
    _admin: AdminManager, session: DatabaseSession
) -> list[DocumentRequirementRead]:
    rows = await CheckoutRepository(session).list_requirements(active_only=False)
    return [DocumentRequirementRead.model_validate(item) for item in rows]


@admin_router.post(
    "/document-requirements",
    response_model=DocumentRequirementRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_document_requirement(
    payload: DocumentRequirementWrite,
    _admin: AdminManager,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> DocumentRequirementRead:
    item = await CheckoutRepository(session).create_requirement(payload)
    await session.commit()
    await session.refresh(item)
    return DocumentRequirementRead.model_validate(item)


@admin_router.put(
    "/document-requirements/{requirement_id}",
    response_model=DocumentRequirementRead,
)
async def update_document_requirement(
    requirement_id: int,
    payload: DocumentRequirementWrite,
    _admin: AdminManager,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> DocumentRequirementRead:
    repository = CheckoutRepository(session)
    item = await repository.get_requirement(requirement_id)
    if item is None:
        raise HTTPException(404, "نوع مدرک پیدا نشد")
    await repository.update_requirement(item, payload)
    await session.commit()
    await session.refresh(item)
    return DocumentRequirementRead.model_validate(item)


def _passenger_name(
    passengers: list[dict[str, Any]] | None, passenger_index: int | None
) -> str | None:
    if passenger_index is None or not passengers or passenger_index >= len(passengers):
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
    return (
        str(passenger.get("fullName") or passenger.get("full_name") or "").strip()
        or None
    )


def _document_read(
    document,
    passenger_name: str | None = None,
    *,
    customer_name: str | None = None,
    booking_number: str | None = None,
) -> BookingDocumentRead:
    return BookingDocumentRead.model_validate(document).model_copy(
        update={
            "passenger_name": passenger_name,
            "customer_name": customer_name,
            "booking_number": booking_number,
        }
    )


@admin_router.get("/documents", response_model=list[BookingDocumentRead])
async def admin_documents(
    _admin: AdminManager,
    session: DatabaseSession,
    booking_id: int | None = None,
) -> list[BookingDocumentRead]:
    rows = await CheckoutRepository(session).list_admin_documents(booking_id)
    booking_ids = {document.booking_id for document in rows}
    context_by_booking: dict[int, tuple[list[dict[str, Any]], str, str]] = {}
    if booking_ids:
        booking_rows = await session.execute(
            select(
                BookingRequest.id,
                BookingRequest.passenger_details,
                BookingRequest.booking_number,
                CustomerUser.full_name,
            )
            .join(CustomerUser, CustomerUser.id == BookingRequest.customer_id)
            .where(BookingRequest.id.in_(booking_ids))
        )
        context_by_booking = {
            booking_id: (passengers, booking_number, customer_name)
            for booking_id, passengers, booking_number, customer_name in booking_rows
        }
    return [
        _document_read(
            document,
            _passenger_name(
                context_by_booking.get(document.booking_id, ([], "", ""))[0],
                document.passenger_index,
            ),
            customer_name=context_by_booking.get(document.booking_id, ([], "", ""))[2],
            booking_number=context_by_booking.get(document.booking_id, ([], "", ""))[1],
        )
        for document in rows
    ]


@admin_router.patch("/documents/{document_id}", response_model=BookingDocumentRead)
async def review_document(
    document_id: int,
    payload: DocumentReview,
    admin: AdminManager,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> BookingDocumentRead:
    repository = CheckoutRepository(session)
    document = await repository.get_document(document_id)
    if document is None:
        raise HTTPException(404, "مدرک پیدا نشد")
    repository.review_document(
        document,
        admin_id=admin.id,
        status=payload.status,
        note=payload.review_note,
    )
    repository.add_event(
        booking_id=document.booking_id,
        actor_type="admin",
        actor_id=admin.id,
        event_type=f"document_{payload.status}",
        note=payload.review_note,
        payload={"documentId": document.id},
    )
    await session.commit()
    await session.refresh(document)
    booking_context = await session.execute(
        select(
            BookingRequest.passenger_details,
            BookingRequest.booking_number,
            CustomerUser.full_name,
        )
        .join(CustomerUser, CustomerUser.id == BookingRequest.customer_id)
        .where(BookingRequest.id == document.booking_id)
    )
    passenger_details, booking_number, customer_name = (
        booking_context.one_or_none()
        or (
            [],
            "",
            "",
        )
    )
    return _document_read(
        document,
        _passenger_name(passenger_details, document.passenger_index),
        customer_name=customer_name,
        booking_number=booking_number,
    )


@admin_router.get("/documents/{document_id}/download")
async def admin_document_download(
    document_id: int, _admin: AdminManager, session: DatabaseSession
) -> FileResponse:
    document = await CheckoutRepository(session).get_document(document_id)
    if document is None:
        raise HTTPException(404, "مدرک پیدا نشد")
    return await _private_file(
        document.storage_key, document.original_name, document.mime_type
    )


@admin_router.patch("/installments/{installment_id}", response_model=InstallmentLine)
async def review_installment_payment(
    installment_id: int,
    payload: InstallmentPaymentReview,
    admin: AdminManager,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> InstallmentLine:
    repository = CheckoutRepository(session)
    installment = await repository.get_installment(installment_id)
    if installment is None:
        raise HTTPException(404, "قسط پیدا نشد")
    installment.status = payload.status
    installment.paid_amount = payload.paid_amount
    installment.payment_reference = payload.payment_reference
    installment.admin_note = payload.admin_note
    if payload.due_date is not None:
        installment.due_date = payload.due_date
    if payload.status == "paid":
        installment.paid_at = datetime.now(UTC)
    repository.add_event(
        booking_id=installment.booking_id,
        actor_type="admin",
        actor_id=admin.id,
        event_type="installment_updated",
        note=payload.admin_note,
        payload={
            "installmentId": installment.id,
            "status": payload.status,
            "paidAmount": str(payload.paid_amount),
        },
    )
    await session.commit()
    await session.refresh(installment)
    return InstallmentLine.model_validate(installment)
