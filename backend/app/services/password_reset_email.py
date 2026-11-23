"""Password-reset email delivery for customer and administrator accounts."""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import Settings


def smtp_is_configured(settings: Settings) -> bool:
    """Return whether a real outbound email channel is configured."""
    return bool(
        settings.PASSWORD_RESET_EMAIL_ENABLED
        and settings.SMTP_HOST
        and settings.SMTP_FROM_EMAIL
    )


def _send_with_smtp(
    *, settings: Settings, recipient: str, subject: str, body: str
) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(body)

    if settings.SMTP_USE_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as client:
            client.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                client.login(
                    settings.SMTP_USERNAME,
                    settings.SMTP_PASSWORD.get_secret_value(),
                )
            client.send_message(message)
    else:
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=10,
            context=ssl.create_default_context(),
        ) as client:
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                client.login(
                    settings.SMTP_USERNAME,
                    settings.SMTP_PASSWORD.get_secret_value(),
                )
            client.send_message(message)


async def deliver_password_reset_email(
    *, settings: Settings, recipient: str, reset_url: str
) -> bool:
    """Send the customer reset link when SMTP is available."""
    if not smtp_is_configured(settings):
        return False
    await asyncio.to_thread(
        _send_with_smtp,
        settings=settings,
        recipient=recipient,
        subject="بازیابی رمز عبور جهان باستان",
        body=(
            "برای تعیین رمز عبور جدید، حداکثر تا "
            f"{settings.PASSWORD_RESET_TTL_MINUTES} دقیقه از این لینک استفاده کنید:\n\n"
            f"{reset_url}\n\n"
            "اگر این درخواست را شما ثبت نکرده‌اید، این پیام را نادیده بگیرید."
        ),
    )
    return True


async def deliver_admin_password_reset_code_email(
    *, settings: Settings, recipient: str, code: str
) -> bool:
    """Send a short-lived, single-use administrator password-recovery code."""
    if not smtp_is_configured(settings):
        return False
    await asyncio.to_thread(
        _send_with_smtp,
        settings=settings,
        recipient=recipient,
        subject="کد بازیابی رمز پنل مدیریت جهان باستان",
        body=(
            "درخواست بازیابی رمز عبور پنل مدیریت ثبت شده است.\n\n"
            f"کد بازیابی: {code}\n\n"
            f"این کد فقط {settings.ADMIN_PASSWORD_RESET_TTL_MINUTES} دقیقه اعتبار دارد "
            "و پس از یک‌بار استفاده منقضی می‌شود.\n\n"
            "اگر این درخواست را شما ثبت نکرده‌اید، این پیام را نادیده بگیرید."
        ),
    )
    return True
