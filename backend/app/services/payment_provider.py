"""Provider-neutral online payment request and verification adapter."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import Settings


class PaymentProviderError(RuntimeError):
    """Raised when the payment gateway cannot complete a trusted operation."""


@dataclass(frozen=True)
class GatewayRequest:
    authority: str
    checkout_url: str


@dataclass(frozen=True)
class GatewayVerification:
    verified: bool
    reference: str | None = None


def payment_provider_is_configured(settings: Settings) -> bool:
    return bool(
        settings.PAYMENT_PROVIDER == "custom"
        and settings.PAYMENT_CALLBACK_BASE_URL
        and settings.PAYMENT_REQUEST_URL
        and settings.PAYMENT_VERIFY_URL
        and settings.PAYMENT_API_KEY
    )


def _headers(settings: Settings) -> dict[str, str]:
    assert settings.PAYMENT_API_KEY is not None
    return {
        "Authorization": f"Bearer {settings.PAYMENT_API_KEY.get_secret_value()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _post(
    settings: Settings, url: str, payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(
            timeout=settings.PAYMENT_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(url, headers=_headers(settings), json=payload)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PaymentProviderError("payment provider request failed") from exc
    if not isinstance(data, dict):
        raise PaymentProviderError("payment provider returned an invalid response")
    return data


async def create_gateway_request(
    settings: Settings,
    *,
    reference: str,
    amount: Decimal,
    currency: str,
    description: str,
) -> GatewayRequest:
    if not payment_provider_is_configured(settings):
        raise PaymentProviderError("payment provider is not configured")
    callback_base = str(settings.PAYMENT_CALLBACK_BASE_URL).rstrip("/")
    assert settings.PAYMENT_REQUEST_URL is not None
    data = await _post(
        settings,
        str(settings.PAYMENT_REQUEST_URL),
        {
            "reference": reference,
            "amount": str(amount),
            "currency": currency,
            "description": description,
            "callbackUrl": f"{callback_base}/api/v1/payments/callback",
        },
    )
    authority = str(data.get("authority") or "").strip()
    checkout_url = str(data.get("checkoutUrl") or "").strip()
    if not authority or not checkout_url.startswith("https://"):
        raise PaymentProviderError("payment provider response is incomplete")
    return GatewayRequest(authority=authority, checkout_url=checkout_url)


async def verify_gateway_payment(
    settings: Settings,
    *,
    authority: str,
    amount: Decimal,
    currency: str,
) -> GatewayVerification:
    if not payment_provider_is_configured(settings):
        raise PaymentProviderError("payment provider is not configured")
    assert settings.PAYMENT_VERIFY_URL is not None
    data = await _post(
        settings,
        str(settings.PAYMENT_VERIFY_URL),
        {"authority": authority, "amount": str(amount), "currency": currency},
    )
    return GatewayVerification(
        verified=data.get("verified") is True or data.get("success") is True,
        reference=str(data.get("reference") or "").strip() or None,
    )
