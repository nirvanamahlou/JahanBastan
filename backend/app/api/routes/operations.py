"""Local CRM, retention, moderation and dashboard endpoints."""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies.auth import (
    AdminManager,
    CurrentCustomer,
    DatabaseSession,
    TrustedOrigin,
)
from app.repositories.operations import OperationsRepository
from app.schemas.operations import (
    CancellationCreate,
    CancellationRead,
    CancellationUpdate,
    CustomerNotificationRead,
    DiscountCodeCreate,
    DiscountCodeRead,
    DiscountCodeUpdate,
    LeadCreate,
    LeadRead,
    LeadUpdate,
    NewsletterSubscribe,
    NewsletterSubscriberRead,
    OperationsDashboardRead,
    ProductReviewCreate,
    ProductReviewRead,
    ProductReviewUpdate,
    PublicProductReviewRead,
)

public_router = APIRouter(tags=["public-operations"])
customer_router = APIRouter(prefix="/account", tags=["account-operations"])
admin_router = APIRouter(prefix="/admin", tags=["admin-operations"])


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="record not found"
    )


@public_router.post(
    "/newsletter/subscribers",
    response_model=NewsletterSubscriberRead,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_newsletter(
    payload: NewsletterSubscribe,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> NewsletterSubscriberRead:
    value = await OperationsRepository(session).subscribe_newsletter(payload)
    await session.commit()
    return NewsletterSubscriberRead.model_validate(value)


@public_router.get("/reviews", response_model=list[PublicProductReviewRead])
async def list_public_reviews(
    session: DatabaseSession,
    target_type: Annotated[Literal["tour", "hotel", "page"], Query()],
    target_id: Annotated[int | None, Query(gt=0)] = None,
    page_path: Annotated[str | None, Query(min_length=1, max_length=300)] = None,
) -> list[PublicProductReviewRead]:
    if target_type == "page":
        if not page_path or not page_path.startswith("/") or page_path.startswith("//"):
            raise HTTPException(status_code=422, detail="valid page_path is required")
    elif target_id is None:
        raise HTTPException(status_code=422, detail="target_id is required")
    values = await OperationsRepository(session).list_public_reviews(
        target_type, target_id, page_path
    )
    return [PublicProductReviewRead.model_validate(value) for value in values]


@customer_router.post(
    "/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED
)
async def create_lead(
    payload: LeadCreate,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> LeadRead:
    value = await OperationsRepository(session).create_lead(customer, payload)
    await session.commit()
    return LeadRead.model_validate(value)


@customer_router.get("/leads", response_model=list[LeadRead])
async def list_customer_leads(
    customer: CurrentCustomer, session: DatabaseSession
) -> list[LeadRead]:
    values = await OperationsRepository(session).list_customer_leads(customer.id)
    return [LeadRead.model_validate(value) for value in values]


@customer_router.post(
    "/bookings/{booking_id}/cancellations",
    response_model=CancellationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_cancellation(
    booking_id: int,
    payload: CancellationCreate,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CancellationRead:
    try:
        value = await OperationsRepository(session).create_cancellation(
            customer.id, booking_id, payload
        )
        await session.commit()
    except LookupError as exc:
        await session.rollback()
        raise _not_found() from exc
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return CancellationRead.model_validate(value)


@customer_router.get("/cancellations", response_model=list[CancellationRead])
async def list_customer_cancellations(
    customer: CurrentCustomer, session: DatabaseSession
) -> list[CancellationRead]:
    values = await OperationsRepository(session).list_customer_cancellations(
        customer.id
    )
    return [CancellationRead.model_validate(value) for value in values]


@customer_router.post(
    "/reviews", response_model=ProductReviewRead, status_code=status.HTTP_201_CREATED
)
async def create_review(
    payload: ProductReviewCreate,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> ProductReviewRead:
    try:
        value = await OperationsRepository(session).create_review(customer, payload)
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ProductReviewRead.model_validate(value)


@customer_router.get("/notifications", response_model=list[CustomerNotificationRead])
async def list_notifications(
    customer: CurrentCustomer, session: DatabaseSession
) -> list[CustomerNotificationRead]:
    values = await OperationsRepository(session).list_notifications(customer.id)
    return [CustomerNotificationRead.model_validate(value) for value in values]


@customer_router.patch(
    "/notifications/{notification_id}/read", response_model=CustomerNotificationRead
)
async def mark_notification_read(
    notification_id: int,
    customer: CurrentCustomer,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CustomerNotificationRead:
    value = await OperationsRepository(session).mark_notification_read(
        customer.id, notification_id
    )
    if value is None:
        raise _not_found()
    await session.commit()
    return CustomerNotificationRead.model_validate(value)


@admin_router.get("/operations/dashboard", response_model=OperationsDashboardRead)
async def operations_dashboard(
    admin: AdminManager, session: DatabaseSession
) -> OperationsDashboardRead:
    del admin
    return OperationsDashboardRead.model_validate(
        await OperationsRepository(session).extended_dashboard()
    )


@admin_router.get("/leads", response_model=list[LeadRead])
async def list_admin_leads(
    admin: AdminManager,
    session: DatabaseSession,
    lead_status: str | None = Query(default=None, alias="status"),
) -> list[LeadRead]:
    del admin
    values = await OperationsRepository(session).list_admin_leads(lead_status)
    return [LeadRead.model_validate(value) for value in values]


@admin_router.patch("/leads/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> LeadRead:
    repository = OperationsRepository(session)
    value = await repository.get_lead(lead_id)
    if value is None:
        raise _not_found()
    value = await repository.update_lead(value, payload, admin.id)
    await session.commit()
    return LeadRead.model_validate(value)


@admin_router.get("/cancellations", response_model=list[CancellationRead])
async def list_admin_cancellations(
    admin: AdminManager,
    session: DatabaseSession,
    cancellation_status: str | None = Query(default=None, alias="status"),
) -> list[CancellationRead]:
    del admin
    values = await OperationsRepository(session).list_admin_cancellations(
        cancellation_status
    )
    return [CancellationRead.model_validate(value) for value in values]


@admin_router.patch("/cancellations/{cancellation_id}", response_model=CancellationRead)
async def update_cancellation(
    cancellation_id: int,
    payload: CancellationUpdate,
    admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> CancellationRead:
    repository = OperationsRepository(session)
    value = next(
        (
            item
            for item in await repository.list_admin_cancellations()
            if item.id == cancellation_id
        ),
        None,
    )
    if value is None:
        raise _not_found()
    try:
        value = await repository.update_cancellation(value, payload, admin.id)
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return CancellationRead.model_validate(value)


@admin_router.get(
    "/newsletter/subscribers", response_model=list[NewsletterSubscriberRead]
)
async def list_newsletter_subscribers(
    admin: AdminManager, session: DatabaseSession
) -> list[NewsletterSubscriberRead]:
    del admin
    values = await OperationsRepository(session).list_newsletter()
    return [NewsletterSubscriberRead.model_validate(value) for value in values]


@admin_router.get("/discount-codes", response_model=list[DiscountCodeRead])
async def list_discounts(
    admin: AdminManager, session: DatabaseSession
) -> list[DiscountCodeRead]:
    del admin
    values = await OperationsRepository(session).list_discounts()
    return [DiscountCodeRead.model_validate(value) for value in values]


@admin_router.post(
    "/discount-codes",
    response_model=DiscountCodeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_discount(
    payload: DiscountCodeCreate,
    admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> DiscountCodeRead:
    del admin
    try:
        value = await OperationsRepository(session).create_discount(payload)
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return DiscountCodeRead.model_validate(value)


@admin_router.patch("/discount-codes/{discount_id}", response_model=DiscountCodeRead)
async def update_discount(
    discount_id: int,
    payload: DiscountCodeUpdate,
    admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> DiscountCodeRead:
    del admin
    repository = OperationsRepository(session)
    value = next(
        (item for item in await repository.list_discounts() if item.id == discount_id),
        None,
    )
    if value is None:
        raise _not_found()
    value = await repository.update_discount(value, payload)
    await session.commit()
    return DiscountCodeRead.model_validate(value)


@admin_router.get("/reviews", response_model=list[ProductReviewRead])
async def list_admin_reviews(
    admin: AdminManager,
    session: DatabaseSession,
    review_status: str | None = Query(default=None, alias="status"),
) -> list[ProductReviewRead]:
    del admin
    values = await OperationsRepository(session).list_admin_reviews(review_status)
    return [ProductReviewRead.model_validate(value) for value in values]


@admin_router.patch("/reviews/{review_id}", response_model=ProductReviewRead)
async def update_review(
    review_id: int,
    payload: ProductReviewUpdate,
    admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> ProductReviewRead:
    repository = OperationsRepository(session)
    value = next(
        (
            item
            for item in await repository.list_admin_reviews()
            if item.id == review_id
        ),
        None,
    )
    if value is None:
        raise _not_found()
    value = await repository.update_review(value, payload, admin.id)
    await session.commit()
    return ProductReviewRead.model_validate(value)
