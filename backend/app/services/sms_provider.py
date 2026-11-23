"""SMS delivery adapters for a generic provider and SMS.ir templates."""

import logging
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)


class SmsProviderError(RuntimeError):
    """Raised when the configured SMS provider cannot complete a request."""


def sms_provider_is_configured(settings: Settings) -> bool:
    if settings.SMS_PROVIDER == "sms_ir":
        return bool(
            settings.SMS_REQUEST_URL
            and settings.SMS_API_KEY
            and _template_token(settings, "login")
        )
    return bool(
        settings.SMS_PROVIDER == "custom"
        and settings.SMS_REQUEST_URL
        and settings.SMS_VERIFY_URL
        and settings.SMS_API_KEY
    )


def _headers(settings: Settings) -> dict[str, str]:
    assert settings.SMS_API_KEY is not None
    if settings.SMS_PROVIDER == "sms_ir":
        return {
            "X-API-KEY": settings.SMS_API_KEY.get_secret_value(),
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    return {
        "Authorization": f"Bearer {settings.SMS_API_KEY.get_secret_value()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _sms_ir_mobile(phone: str) -> str:
    """Return an Iranian mobile number in SMS.ir's conventional 09... format."""
    digits = "".join(character for character in phone if character.isdigit())
    if digits.startswith("98") and len(digits) == 12:
        return "0" + digits[2:]
    if digits.startswith("9") and len(digits) == 10:
        return "0" + digits
    return digits


def _sms_ir_template_id(template: str | None) -> int:
    try:
        return int(template or "")
    except ValueError as exc:
        raise SmsProviderError("SMS.ir template ID is invalid") from exc


async def _post(
    settings: Settings, url: str, payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=settings.SMS_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=_headers(settings), json=payload)
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "SMS provider rejected the request (provider=%s, status=%s)",
            settings.SMS_PROVIDER,
            exc.response.status_code,
        )
        raise SmsProviderError("SMS provider request failed") from exc
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "SMS provider request failed (provider=%s, error=%s)",
            settings.SMS_PROVIDER,
            type(exc).__name__,
        )
        raise SmsProviderError("SMS provider request failed") from exc
    if not isinstance(data, dict):
        raise SmsProviderError("SMS provider returned an invalid response")
    return data


def _template_token(settings: Settings, purpose: str) -> str | None:
    template = (
        settings.SMS_LOGIN_TEMPLATE_TOKEN
        if purpose == "login"
        else settings.SMS_FORGOT_PASSWORD_TEMPLATE_TOKEN
    )
    if template is not None:
        return template.get_secret_value()
    return settings.SMS_TEMPLATE


async def _send_sms_ir_template(
    settings: Settings, *, phone: str, template: str | None, code: str
) -> None:
    assert settings.SMS_REQUEST_URL is not None
    data = await _post(
        settings,
        str(settings.SMS_REQUEST_URL),
        {
            "Mobile": _sms_ir_mobile(phone),
            "TemplateId": _sms_ir_template_id(template),
            "Parameters": [
                {"name": settings.SMS_LOGIN_TEMPLATE_PARAMETER, "value": code}
            ],
        },
    )
    if data.get("status") == 0 or data.get("success") is False:
        logger.warning("SMS.ir rejected the verification template request")
        raise SmsProviderError("SMS.ir rejected the template request")


async def request_login_code(
    settings: Settings, phone: str, code: str | None = None
) -> None:
    if not sms_provider_is_configured(settings):
        raise SmsProviderError("SMS provider is not configured")
    if settings.SMS_PROVIDER == "sms_ir":
        if code is None:
            raise SmsProviderError("SMS login code is required")
        await _send_sms_ir_template(
            settings,
            phone=phone,
            template=_template_token(settings, "login"),
            code=code,
        )
        return
    payload: dict[str, Any] = {"phone": phone, "purpose": "login"}
    if template := _template_token(settings, "login"):
        payload["template"] = template
    assert settings.SMS_REQUEST_URL is not None
    data = await _post(settings, str(settings.SMS_REQUEST_URL), payload)
    if data.get("accepted") is False or data.get("success") is False:
        raise SmsProviderError("SMS provider rejected the login code request")


async def request_password_reset_sms(
    settings: Settings, phone: str, reset_url: str
) -> None:
    """Send the reset link through the provider's dedicated recovery template."""
    if not sms_provider_is_configured(settings):
        raise SmsProviderError("SMS provider is not configured")
    if settings.SMS_PROVIDER == "sms_ir":
        raise SmsProviderError(
            "SMS.ir password recovery requires a code-based recovery form"
        )
    payload: dict[str, Any] = {
        "phone": phone,
        "purpose": "password_reset",
        "resetUrl": reset_url,
    }
    if template := _template_token(settings, "password_reset"):
        payload["template"] = template
    assert settings.SMS_REQUEST_URL is not None
    data = await _post(settings, str(settings.SMS_REQUEST_URL), payload)
    if data.get("accepted") is False or data.get("success") is False:
        raise SmsProviderError("SMS provider rejected the password reset request")


async def verify_login_code(settings: Settings, phone: str, code: str) -> bool:
    if not sms_provider_is_configured(settings):
        raise SmsProviderError("SMS provider is not configured")
    if settings.SMS_PROVIDER == "sms_ir":
        raise SmsProviderError("SMS.ir login codes are verified by the application")
    assert settings.SMS_VERIFY_URL is not None
    data = await _post(
        settings,
        str(settings.SMS_VERIFY_URL),
        {"phone": phone, "code": code, "purpose": "login"},
    )
    return data.get("verified") is True or data.get("success") is True
