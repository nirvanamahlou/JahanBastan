"""Permission-protected tour-room pricing endpoints."""

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies.auth import DatabaseSession, PricingAdmin, TrustedOrigin
from app.repositories.exchange_rates import ExchangeRateRepository
from app.repositories.pricing import BulkPricingRepository
from app.repositories.pricing_v2 import BulkPricingV2Repository
from app.schemas.pricing import (
    BulkPriceAdjustmentRead,
    BulkPriceAdjustmentRequest,
    BulkPricePreview,
    BulkPricingOptions,
    ExchangeRateRead,
    ExchangeRateWrite,
)
from app.schemas.pricing_v2 import (
    BulkPriceV2Preview,
    BulkPriceV2Request,
    BulkPricingV2Options,
    PricingDepartureOption,
)

router = APIRouter(prefix="/admin/pricing", tags=["admin-pricing"])


def _read(item, name, selected_tours=0, selected_rooms=0):
    return BulkPriceAdjustmentRead(
        id=item.id,
        admin_id=item.admin_id,
        admin_name=name,
        target="tour",
        direction=item.direction,
        amount_toman=item.amount_toman,
        selected_tours=selected_tours,
        selected_rooms=selected_rooms,
        eligible_rates=item.affected_rates,
        skipped_unpriced=item.skipped_unpriced,
        skipped_foreign_currency=item.skipped_foreign_currency,
        blocked_rates=0,
        before_total_toman=item.before_total_toman,
        after_total_toman=item.after_total_toman,
        can_apply=True,
        created_at=item.created_at,
    )


def _read_rate(item, admin_name: str | None = None) -> ExchangeRateRead:
    return ExchangeRateRead(
        code=item.currency_code,
        rate_toman=item.rate_toman,
        updated_at=item.updated_at,
        updated_by_name=admin_name,
    )


@router.get("/exchange-rates", response_model=list[ExchangeRateRead])
async def list_exchange_rates(
    session: DatabaseSession, _pricing_admin: PricingAdmin
) -> list[ExchangeRateRead]:
    rows = await ExchangeRateRepository(session).list_current()
    return [_read_rate(item, admin_name) for item, admin_name in rows]


@router.put("/exchange-rates/{currency_code}", response_model=ExchangeRateRead)
async def update_exchange_rate(
    currency_code: str,
    payload: ExchangeRateWrite,
    session: DatabaseSession,
    pricing_admin: PricingAdmin,
    _trusted_origin: TrustedOrigin,
) -> ExchangeRateRead:
    try:
        item = await ExchangeRateRepository(session).set_rate(
            currency_code, payload.rate_toman, admin_id=pricing_admin.id
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    await session.refresh(item)
    return _read_rate(item, pricing_admin.full_name)


@router.get("/v2/options", response_model=BulkPricingV2Options)
async def options_v2(
    session: DatabaseSession, _pricing_admin: PricingAdmin
) -> BulkPricingV2Options:
    return await BulkPricingV2Repository(session).options()


@router.get(
    "/v2/tours/{tour_id}/departures", response_model=list[PricingDepartureOption]
)
async def departures_v2(
    tour_id: int,
    session: DatabaseSession,
    _pricing_admin: PricingAdmin,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[PricingDepartureOption]:
    return await BulkPricingV2Repository(session).departures(
        tour_id, limit=limit, offset=offset
    )


@router.post("/v2/preview", response_model=BulkPriceV2Preview)
async def preview_v2(
    payload: BulkPriceV2Request,
    session: DatabaseSession,
    _pricing_admin: PricingAdmin,
    _trusted_origin: TrustedOrigin,
) -> BulkPriceV2Preview:
    try:
        return await BulkPricingV2Repository(session).preview(payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post("/v2/apply", response_model=BulkPriceV2Preview)
async def apply_v2(
    payload: BulkPriceV2Request,
    session: DatabaseSession,
    pricing_admin: PricingAdmin,
    _trusted_origin: TrustedOrigin,
) -> BulkPriceV2Preview:
    try:
        _audit, preview = await BulkPricingV2Repository(session).apply(
            payload, admin_id=pricing_admin.id
        )
        await session.commit()
    except (ValueError, RuntimeError) as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return preview


@router.get("/options", response_model=BulkPricingOptions)
async def options(session: DatabaseSession, _pricing_admin: PricingAdmin):
    return await BulkPricingRepository(session).options()


@router.post("/preview", response_model=BulkPricePreview)
async def preview(
    payload: BulkPriceAdjustmentRequest,
    session: DatabaseSession,
    _pricing_admin: PricingAdmin,
    _trusted_origin: TrustedOrigin,
):
    try:
        return await BulkPricingRepository(session).preview(payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post("/apply", response_model=BulkPriceAdjustmentRead)
async def apply(
    payload: BulkPriceAdjustmentRequest,
    session: DatabaseSession,
    pricing_admin: PricingAdmin,
    _trusted_origin: TrustedOrigin,
):
    repo = BulkPricingRepository(session)
    try:
        item, preview = await repo.apply(payload, admin_id=pricing_admin.id)
        await session.commit()
    except (ValueError, RuntimeError) as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.refresh(item)
    return _read(
        item, pricing_admin.full_name, preview.selected_tours, preview.selected_rooms
    )


@router.get("/history", response_model=list[BulkPriceAdjustmentRead])
async def history(
    session: DatabaseSession,
    _pricing_admin: PricingAdmin,
    limit: int = Query(default=30, ge=1, le=100),
):
    return [
        _read(item, name)
        for item, name in await BulkPricingRepository(session).history(limit=limit)
    ]
