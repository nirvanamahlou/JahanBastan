"""Trusted creation and verification flow for customer wallet top-ups."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import PaymentIntent, PaymentStatus
from app.models.content import CustomerWallet, WalletTopUp
from app.schemas.payment import WalletTopUpCreate, WalletTopUpRead
from app.services.payment_provider import (
    PaymentProviderError,
    create_gateway_request,
    payment_provider_is_configured,
    verify_gateway_payment,
)


def _to_response(
    topup: WalletTopUp,
    intent: PaymentIntent,
    *,
    checkout_url: str | None = None,
) -> WalletTopUpRead:
    return WalletTopUpRead(
        id=topup.id,
        reference=topup.reference,
        amount=topup.amount,
        currency=topup.currency,
        status=topup.status,
        provider=intent.provider,
        created_at=topup.created_at,
        checkout_url=checkout_url,
    )


def _redirect(settings: Settings, topup: WalletTopUp, state: str) -> RedirectResponse:
    public_url = settings.PUBLIC_SITE_URL.rstrip("/")
    return RedirectResponse(
        f"{public_url}/account/?tab=wallet&topup={state}&reference={topup.reference}",
        status_code=303,
    )


async def create_wallet_topup(
    session: AsyncSession,
    *,
    customer_id: int,
    payload: WalletTopUpCreate,
    settings: Settings,
) -> WalletTopUpRead:
    """Create a server-trusted payment attempt for a wallet recharge."""
    if not payment_provider_is_configured(settings):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "online payment is not configured",
        )

    pending = await session.scalar(
        select(WalletTopUp).where(
            WalletTopUp.customer_id == customer_id,
            WalletTopUp.status == "gateway_pending",
        )
    )
    if pending is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "a wallet top-up is already pending",
        )

    reference = f"WALLET-{customer_id}-{uuid4().hex.upper()}"
    intent = PaymentIntent(
        customer_user_id=customer_id,
        crm_contract_number=reference,
        amount=payload.amount,
        currency=payload.currency,
        status=PaymentStatus.PENDING,
        provider=settings.PAYMENT_PROVIDER,
    )
    session.add(intent)
    await session.flush()
    topup = WalletTopUp(
        customer_id=customer_id,
        payment_intent_id=intent.id,
        reference=reference,
        amount=payload.amount,
        currency=payload.currency,
        status="pending",
    )
    session.add(topup)
    await session.commit()
    await session.refresh(intent)
    await session.refresh(topup)

    try:
        gateway = await create_gateway_request(
            settings,
            reference=str(intent.id),
            amount=intent.amount,
            currency=intent.currency,
            description="Jahan Bastan wallet top-up",
        )
    except PaymentProviderError as exc:
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "wallet top-up gateway request failed"
        topup.status = "failed"
        await session.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "payment gateway is temporarily unavailable",
        ) from exc

    intent.provider_authority = gateway.authority
    intent.status = PaymentStatus.GATEWAY_PENDING
    topup.status = "gateway_pending"
    await session.commit()
    await session.refresh(topup)
    return _to_response(topup, intent, checkout_url=gateway.checkout_url)


async def handle_wallet_topup_callback(
    session: AsyncSession,
    *,
    intent: PaymentIntent,
    authority: str,
    gateway_status: str,
    settings: Settings,
) -> RedirectResponse | None:
    """Settle a verified top-up once; duplicate callbacks only return success."""
    topup = await session.scalar(
        select(WalletTopUp).where(WalletTopUp.payment_intent_id == intent.id)
    )
    if topup is None:
        return None
    if topup.status == "paid":
        return _redirect(settings, topup, "success")
    if topup.status == "failed":
        return _redirect(settings, topup, "failed")

    if gateway_status.lower() in {"cancelled", "canceled", "failed"}:
        topup.status = "failed"
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "customer cancelled wallet top-up"
        await session.commit()
        return _redirect(settings, topup, "cancelled")

    try:
        verification = await verify_gateway_payment(
            settings,
            authority=authority,
            amount=intent.amount,
            currency=intent.currency,
        )
    except PaymentProviderError:
        return _redirect(settings, topup, "pending")

    if not verification.verified:
        topup.status = "failed"
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "wallet top-up verification rejected"
        await session.commit()
        return _redirect(settings, topup, "failed")

    locked_topup = await session.scalar(
        select(WalletTopUp)
        .execution_options(populate_existing=True)
        .where(WalletTopUp.id == topup.id)
        .with_for_update()
    )
    if locked_topup is None:
        return _redirect(settings, topup, "failed")
    if locked_topup.status == "paid":
        return _redirect(settings, locked_topup, "success")
    if locked_topup.status == "failed":
        return _redirect(settings, locked_topup, "failed")

    wallet = await session.scalar(
        select(CustomerWallet)
        .where(CustomerWallet.customer_id == intent.customer_user_id)
        .with_for_update()
    )
    if wallet is None:
        wallet = CustomerWallet(
            customer_id=intent.customer_user_id,
            currency=locked_topup.currency,
        )
        session.add(wallet)
        await session.flush()
    if wallet.currency != locked_topup.currency:
        locked_topup.status = "failed"
        intent.status = PaymentStatus.FAILED
        intent.failure_reason = "wallet currency mismatch"
        await session.commit()
        return _redirect(settings, locked_topup, "failed")

    wallet.available_credit += locked_topup.amount
    locked_topup.status = "paid"
    locked_topup.credited_at = datetime.now(UTC)
    intent.status = PaymentStatus.PAID
    intent.provider_reference = verification.reference
    intent.verified_at = datetime.now(UTC)
    await session.commit()
    return _redirect(settings, locked_topup, "success")
