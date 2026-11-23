"""Checkout calculations and private document persistence."""

from __future__ import annotations

import asyncio
import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.checkout import (
    InstallmentLine,
    InstallmentQuote,
    InstallmentQuoteRequest,
    rounded_money,
)
from app.services.private_storage import store_private_bytes
from app.services.upload_safety import validate_document_bytes

ALLOWED_DOCUMENT_MIMES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
}


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def calculate_installment_quote(payload: InstallmentQuoteRequest) -> InstallmentQuote:
    financed = payload.total_amount - payload.down_payment
    fee = rounded_money(
        financed * payload.monthly_fee_rate / Decimal(100) * payload.months
    )
    installment_total = financed + fee
    monthly = rounded_money(installment_total / payload.months)
    schedule: list[InstallmentLine] = []
    allocated = Decimal(0)
    for index in range(payload.months):
        amount = (
            monthly if index < payload.months - 1 else installment_total - allocated
        )
        allocated += amount
        schedule.append(
            InstallmentLine(
                sequence=index + 1,
                due_date=add_months(payload.first_due_date, index),
                amount=amount,
            )
        )
    return InstallmentQuote(
        total_amount=payload.total_amount,
        down_payment=payload.down_payment,
        financed_amount=financed,
        fee_amount=fee,
        installment_total=installment_total,
        monthly_amount=monthly,
        months=payload.months,
        first_due_date=payload.first_due_date,
        schedule=schedule,
    )


async def store_private_document(
    upload: UploadFile,
    *,
    allowed_extensions: list[str],
    max_bytes: int,
) -> tuple[str, str, int]:
    mime_type = (upload.content_type or "").casefold()
    extension = ALLOWED_DOCUMENT_MIMES.get(mime_type)
    if extension is None or extension not in {
        item.casefold() for item in allowed_extensions
    }:
        raise HTTPException(415, "فقط فایل PDF، JPG یا PNG مجاز است")
    content = await upload.read(max_bytes + 1)
    if not content:
        raise HTTPException(415, "فایل خالی یا نامعتبر است")
    if len(content) > max_bytes:
        raise HTTPException(413, "حجم فایل بیشتر از حد مجاز است")
    await asyncio.to_thread(validate_document_bytes, content, extension)

    settings = get_settings()
    key = f"private-bookings/{uuid.uuid4().hex}.{extension}"
    await store_private_bytes(key, content, settings)
    return key, mime_type, len(content)
