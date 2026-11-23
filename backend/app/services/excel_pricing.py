"""Validated Excel parsing and persistence for hotel and tour-price imports."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import ParseError
from zipfile import BadZipFile

from openpyxl import load_workbook
from openpyxl.cell.cell import Cell
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter
from openpyxl.utils.exceptions import InvalidFileException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Destination,
    Hotel,
    HotelRoom,
    PublicationStatus,
    Tour,
    TourDeparture,
    TourDepartureHotelPrice,
)
from app.repositories.excel_pricing import load_departure_prices_for_import
from app.repositories.tour_card_price import refresh_tour_card_price
from app.schemas.editorial_management import HotelWrite

MAX_ROWS = 500
MAX_PRICE = Decimal("99999999999999")
HOTEL_COLUMNS = [
    "hotel_code",
    "name",
    "destination",
    "city",
    "region",
    "address",
    "star_rating",
    "service_grade",
    "service_type",
    "default_room_type",
    "amenities",
    "description",
    "refund_policy",
    "hotel_policy",
    "main_image_url",
    "gallery_urls",
    "status",
    "is_featured",
    "notes",
]
HOTEL_HEADER_ALIASES: dict[str, set[str]] = {
    "hotel_code": {
        "hotel code",
        "hotel id",
        "hotel_code",
        "hotel_id",
        "شناسه هتل",
        "کد هتل",
    },
    "name": {"hotel name", "name", "hotel_name", "hkt", "نام هتل"},
    "destination": {"destination", "مقصد", "مقصد هتل"},
    "city": {"city", "شهر"},
    "region": {"region", "location", "loc", "لوک", "منطقه", "موقعیت", "موقعیت هتل"},
    "address": {"address", "آدرس", "نشانی", "آدرس هتل"},
    "star_rating": {
        "star rating",
        "stars",
        "star_rating",
        "تعداد ستاره",
        "درجه ستاره",
        "ستاره",
        "ستاره هتل",
        "درجه هتل",
    },
    "service_grade": {"service grade", "service_grade", "درجه خدمات", "سطح خدمات"},
    "service_type": {
        "service type",
        "service_type",
        "نوع خدمات",
        "خدمات",
        "سرویس",
        "نوع سرویس",
    },
    "default_room_type": {
        "default room type",
        "default_room_type",
        "نوع اتاق پیش‌فرض",
        "اتاق پیش‌فرض",
        "نوع اتاق",
    },
    "amenities": {"amenities", "امکانات", "امکانات هتل"},
    "description": {"description", "توضیحات"},
    "refund_policy": {
        "refund policy",
        "refund_policy",
        "قوانین استرداد",
        "شرایط استرداد",
        "قوانین کنسلی",
    },
    "hotel_policy": {"hotel policy", "hotel_policy", "قوانین هتل", "مقررات هتل"},
    "main_image_url": {
        "main image url",
        "main_image_url",
        "آدرس تصویر اصلی",
        "لینک تصویر اصلی",
        "نشانی تصویر اصلی",
    },
    "gallery_urls": {
        "gallery urls",
        "gallery_urls",
        "تصاویر گالری",
        "آدرس تصاویر گالری",
        "لینک تصاویر گالری",
    },
    "status": {"status", "وضعیت", "وضعیت انتشار"},
    "is_featured": {"is featured", "is_featured", "پرفروش", "ویژه", "هتل ویژه"},
    "notes": {"notes", "یادداشت", "یادداشت داخلی"},
}
REQUIRED_HOTEL_COLUMNS = {"name", "destination", "star_rating"}

PRICE_HEADER_ALIASES: dict[str, set[str]] = {
    "hotel_code": HOTEL_HEADER_ALIASES["hotel_code"],
    "departure_date": {
        "departure_date",
        "تاریخ حرکت",
        "تاریخ رفت",
        "تاریخ برگزاری",
        "تاریخ برگزاری تور",
        "تاریخ تور",
        "تاریخ شروع",
        "تاریخ اعزام",
    },
    "service_type": {
        "service",
        *HOTEL_HEADER_ALIASES["service_type"],
        "خدمات هتل",
        "سرویس هتل",
    },
    "room_type": {
        "room",
        "room_type",
        "room typ",
        "room types",
        "room category",
        "room name",
        "اتاق",
        "نوع اتاق",
        "نام اتاق",
        "تایپ اتاق",
        "تایپ",
        "نوع اتاق هتل",
        "نوع اتاق پیش‌فرض",
        "default room type",
    },
    "double_price": {
        "dbl",
        "double",
        "double_price",
        "دبل",
        "دوبل",
        "دو تخته",
        "دو نفره",
        "اتاق دو تخته",
        "قیمت دبل",
        "قیمت دو تخته",
        "قیمت دو نفره",
        "قیمت اتاق دو تخته",
        "2 تخته",
    },
    "single_price": {
        "sgl",
        "single",
        "single_price",
        "سینگل",
        "تک تخته",
        "یک تخته",
        "یک نفره",
        "اتاق یک تخته",
        "اتاق تک تخته",
        "قیمت سینگل",
        "قیمت تک تخته",
        "قیمت یک تخته",
        "قیمت یک نفره",
        "قیمت اتاق تک تخته",
        "1 تخته",
    },
    "child_with_bed_price": {
        "child w bed",
        "chd w bed",
        "child with bed",
        "child_with_bed_price",
        "کودک با تخت",
        "قیمت کودک با تخت",
        "نرخ کودک با تخت",
    },
    "child_without_bed_price": {
        "child no bed",
        "child without bed",
        "child_without_bed_price",
        "کودک بدون تخت",
        "کودک بی تخت",
        "قیمت کودک بدون تخت",
        "قیمت کودک بی تخت",
        "نرخ کودک بدون تخت",
    },
    "infant_price": {
        "infant",
        "infant_price",
        "نوزاد",
        "قیمت نوزاد",
        "هزینه نوزاد",
        "نرخ نوزاد",
    },
    "flight_price_per_person": {
        "flight per person",
        "flight_price_per_person",
        "پرواز هر نفر",
        "هزینه پرواز هر نفر",
        "قیمت پرواز هر نفر",
        "هزینه پرواز",
        "قیمت پرواز",
        "نرخ پرواز",
        "پرواز بزرگسال و کودک با تخت",
    },
}
OPTIONAL_PRICE_HEADER_ALIASES: dict[str, set[str]] = {
    "hotel_region": {
        "loc",
        "location",
        "region",
        "لوک",
        "منطقه",
        "منطقه هتل",
        "موقعیت هتل",
    },
    "extra_price": {
        "extra",
        "extra_price",
        "extra bed",
        "قیمت اکسترا",
        "نرخ اکسترا",
        "تخت اضافه",
    },
    "child_with_bed_flight_price": {
        "flight child",
        "flight child w bed",
        "flight child with bed",
        "child_with_bed_flight_price",
        "پرواز کودک با تخت",
        "هزینه پرواز کودک با تخت",
    },
    "hotel_name": {"hotel_name", "hkt", "نام هتل", "هتل"},
    "external_price_code": {
        "excel price id",
        "external_price_code",
        "شناسه قیمت excel",
        "شناسه قیمت اکسل",
        "کد قیمت اکسل",
        "شناسه قیمت",
        "کد قیمت",
    },
    "price_set_code": {
        "price set id",
        "price_set_code",
        "شناسه مجموعه قیمت",
        "کد مجموعه قیمت",
        "شناسه پکیج",
        "کد پکیج",
    },
    "is_base_package": {
        "base package",
        "is_base_package",
        "هتل پایه",
        "پکیج پایه",
        "بسته پایه",
    },
}
PRICE_HEADERS = {
    alias: field for field, aliases in PRICE_HEADER_ALIASES.items() for alias in aliases
}
OPTIONAL_PRICE_HEADERS = {
    alias: field
    for field, aliases in OPTIONAL_PRICE_HEADER_ALIASES.items()
    for alias in aliases
}
# A price row may identify a hotel by its saved code (legacy format) or by its
# saved name (the current format).  Every other column remains required.
REQUIRED_PRICE_COLUMNS = set(PRICE_HEADERS.values()) - {
    "room_type",
    "hotel_code",
    "infant_price",
    "flight_price_per_person",
    "child_with_bed_price",
}
HEADER_LABELS_FA = {
    "hotel_code": "شناسه هتل",
    "name": "نام هتل",
    "hotel_name": "نام هتل",
    "hotel_region": "منطقه هتل",
    "destination": "مقصد",
    "star_rating": "تعداد ستاره",
    "departure_date": "تاریخ حرکت",
    "service_type": "نوع خدمات",
    "room_type": "نوع اتاق",
    "double_price": "قیمت دو تخته",
    "single_price": "قیمت تک تخته",
    "child_with_bed_price": "قیمت کودک با تخت",
    "child_without_bed_price": "قیمت کودک بدون تخت",
    "infant_price": "قیمت نوزاد",
    "flight_price_per_person": "هزینه پرواز هر نفر",
    "child_with_bed_flight_price": "هزینه پرواز کودک با تخت",
    "extra_price": "قیمت تخت اضافه",
    "external_price_code": "شناسه قیمت اکسل",
    "price_set_code": "شناسه مجموعه قیمت",
    "is_base_package": "هتل پایه",
}
CURRENCY_SYMBOLS = {
    "$": "USD",
    "€": "EUR",
    "₺": "TRY",
    "₾": "GEL",
    "﷼": "IRR",
}
SHEET_CURRENCIES = {"USD", "EUR", "TRY", "GEL", "IRR", "IRT"}
MISSING_PRICE_VALUES = {"", "n/a", "na", "n.a.", "not available", "-", "—", "–"}
EXCEL_PRICE_ERRORS = {
    "#value!",
    "#ref!",
    "#div/0!",
    "#n/a",
    "#name?",
    "#num!",
    "#null!",
    "#spill!",
    "#calc!",
    "#getting_data",
}
DESTINATION_ALIASES: dict[str, tuple[str, ...]] = {
    "کوشاداسی": ("kusadasi",),
    "بدروم": ("bodrum",),
    "بودروم": ("bodrum",),
}


class WorkbookValidationError(ValueError):
    """A workbook contains invalid headers or rows."""

    def __init__(self, errors: list[dict[str, Any]]) -> None:
        self.errors = errors
        super().__init__("Workbook validation failed")


def _load_excel_workbook(content: bytes, *, data_only: bool = True) -> Any:
    try:
        return load_workbook(BytesIO(content), data_only=data_only)
    except (
        BadZipFile,
        InvalidFileException,
        OSError,
        ParseError,
        ValueError,
        KeyError,
    ) as exc:
        raise WorkbookValidationError(
            [
                {
                    "row": 1,
                    "message": (
                        "فایل .xlsx معتبر نیست یا آسیب دیده است. قالب نمونه را "
                        "دانلود و همان را تکمیل کنید."
                    ),
                }
            ]
        ) from exc


@dataclass(frozen=True)
class HotelImportRow:
    row_number: int
    values: dict[str, Any]


@dataclass(frozen=True)
class PriceImportRow:
    row_number: int
    hotel_code: str
    departure_date: date
    hotel_name: str | None
    service_type: str
    room_type: str
    double_price: Decimal
    single_price: Decimal
    child_with_bed_price: Decimal
    package_currency: str
    child_without_bed_price: Decimal
    child_without_bed_currency: str
    infant_price: Decimal | None
    infant_currency: str
    flight_price_per_person: Decimal
    flight_currency: str
    child_with_bed_flight_price: Decimal | None = None
    child_with_bed_flight_currency: str = "IRT"
    external_price_code: str | None = None
    price_set_code: str | None = None
    is_base_package: bool = False
    warnings: tuple[str, ...] = ()
    double_currency: str | None = None
    single_currency: str | None = None
    child_with_bed_currency: str | None = None
    extra_price: Decimal | None = None
    extra_currency: str | None = None
    hotel_region: str | None = None
    flight_included_in_package: bool = False


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _destination_lookup_key(value: Any) -> str:
    """Normalize destination names without relying on their display spelling."""
    normalized = unicodedata.normalize("NFKD", _text(value).casefold())
    normalized = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    normalized = normalized.translate(
        str.maketrans(
            {
                "ي": "ی",
                "ى": "ی",
                "ك": "ک",
                "ۀ": "ه",
                "ة": "ه",
                "ı": "i",
                "ş": "s",
                "ğ": "g",
                "ü": "u",
                "ö": "o",
                "ç": "c",
            }
        )
    )
    return re.sub(r"[\W_]+", "", normalized)


def _destination_lookup_keys(value: Any) -> tuple[str, ...]:
    key = _destination_lookup_key(value)
    if not key:
        return ()
    return tuple(dict.fromkeys((key, *DESTINATION_ALIASES.get(key, ()))))


def _normalized_header(value: Any) -> str:
    text = unicodedata.normalize("NFKC", _text(value))
    text = text.translate(str.maketrans({"ي": "ی", "ى": "ی", "ك": "ک"}))
    text = re.sub(
        r"[\ufeff\u200b-\u200f\u202a-\u202e\u2066-\u2069\u0640\u064b-\u065f\u0670]",
        "",
        text,
    )
    # Joined, spaced and half-spaced forms identify the same known header.
    return re.sub(r"[\s_-]+", "", _to_ascii_digits(text)).casefold()


def _hotel_name_key(value: str) -> str:
    """Ignore presentation-only differences without guessing hotel identities."""
    text = unicodedata.normalize("NFKC", value)
    text = text.translate(str.maketrans({"ي": "ی", "ى": "ی", "ك": "ک", "\u200c": " "}))
    text = re.sub(r"[\ufeff\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", text)
    text = re.sub(r"\s+", " ", text).strip().casefold()
    return re.sub(r"\s*([()])\s*", r"\1", text)


def _hotel_identity_key(value: str) -> str:
    """Match hotel names across punctuation and generic English property words."""
    name = _hotel_name_key(value)
    words = re.sub(r"[\W_]+", " ", name).split()
    specific = [word for word in words if word not in {"hotel", "resort", "resprt"}]
    identity = " ".join(specific or words)
    # Supplier spellings and descriptions for these specific Kuala Lumpur hotels.
    aliases = {
        "concord kuala lumpu": "concord kuala lumpur",
        "concorde kuala lumpur": "concord kuala lumpur",
        "pavilion the pavilion residences area": "pavilion kuala lumpur",
    }
    return aliases.get(identity, identity)


def _offer_labels(room_type: str, service_type: str) -> tuple[str, str]:
    """Room variants belong to the same hotel but remain independent offers."""
    return _hotel_name_key(room_type), _hotel_name_key(service_type)


def _hotel_star_rating(value: Any) -> int:
    """Parse the 1–5 rating and keep spreadsheet validation actionable."""
    raw = _to_ascii_digits(_text(value))
    if not raw:
        raise ValueError("تعداد ستاره الزامی است؛ عدد صحیح ۱ تا ۵ وارد کنید.")
    cleaned = re.sub(r"\s*(?:\*|★|ستاره)\s*", "", raw, flags=re.IGNORECASE)
    if not cleaned:
        raise ValueError("تعداد ستاره باید عدد صحیح بین ۱ تا ۵ باشد.")
    try:
        star_value = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError("تعداد ستاره باید عدد صحیح بین ۱ تا ۵ باشد.") from exc
    if not star_value.is_finite() or star_value != star_value.to_integral_value():
        raise ValueError("تعداد ستاره باید عدد صحیح بین ۱ تا ۵ باشد.")
    rating = int(star_value)
    if rating not in range(1, 6):
        raise ValueError("تعداد ستاره باید عدد صحیح بین ۱ تا ۵ باشد.")
    return rating


def _import_sheet_and_headers(
    workbook: Any, aliases: dict[str, str], required: set[str]
) -> tuple[Any, int, dict[str, int]]:
    """Find actual headers even when the guide tab or a title row is selected."""
    lookup = {_normalized_header(key): value for key, value in aliases.items()}
    best: tuple[Any, int, list[tuple[int, str | None]]] | None = None
    score = -1
    sheets = [workbook.active, *[s for s in workbook if s != workbook.active]]
    for sheet in sheets:
        # Normal worksheets store cells sparsely. iter_rows() would create a
        # huge empty rectangle when Excel leaves formatting far from the table.
        header_cells: dict[int, list[Any]] = {}
        for cell in list(sheet._cells.values()):
            if cell.row <= 20 and _text(cell.value):
                header_cells.setdefault(cell.row, []).append(cell)
        for number, cells in sorted(header_cells.items()):
            columns = [
                (cell.column - 1, lookup.get(_normalized_header(cell.value)))
                for cell in sorted(cells, key=lambda cell: cell.column)
            ]
            keys = [key for _, key in columns]
            row_score = len(required.intersection(keys))
            if row_score > score:
                best, score = (sheet, number, columns), row_score
    if best is None:
        raise WorkbookValidationError([{"row": 1, "message": "Workbook is empty."}])
    sheet, header_row, columns = best
    keys = [key for _, key in columns]
    missing = required - set(keys)
    duplicates = {key for key in keys if key is not None and keys.count(key) > 1}
    if missing or duplicates:
        fields = ", ".join(
            f"{HEADER_LABELS_FA.get(key, key)} ({key})"
            for key in sorted(duplicates or missing)
        )
        message = (
            "ستون تکراری: " + fields
            if duplicates
            else "ستون‌های الزامی پیدا نشد: " + fields
        )
        raise WorkbookValidationError([{"row": header_row, "message": message}])
    return sheet, header_row, {key: index for index, key in columns if key}


def _import_data_rows(
    sheet: Any, header_row: int, indexes: dict[str, int]
) -> list[tuple[int, dict[str, Any]]]:
    """Read populated import rows without materializing empty worksheet space."""
    columns = {index + 1 for index in indexes.values()}
    row_numbers = sorted(
        {
            cell.row
            for cell in list(sheet._cells.values())
            if cell.row > header_row
            and cell.column in columns
            and (_text(cell.value) or cell.data_type == "f")
        }
    )
    if len(row_numbers) > MAX_ROWS:
        raise WorkbookValidationError(
            [
                {
                    "row": header_row,
                    "message": (
                        f"فایل بیش از {MAX_ROWS} ردیف داده دارد؛ "
                        "اطلاعات را در چند فایل وارد کنید."
                    ),
                }
            ]
        )
    return [
        (number, {key: sheet.cell(number, index + 1) for key, index in indexes.items()})
        for number in row_numbers
    ]


def _to_ascii_digits(value: str) -> str:
    source = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"
    source += "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
    return value.translate(str.maketrans(source, "01234567890123456789"))


def _as_bool(value: Any) -> bool:
    return _to_ascii_digits(_text(value)).casefold() in {
        "1",
        "true",
        "yes",
        "بله",
        "بلی",
        "درست",
        "فعال",
    }


def _publication_status(value: Any) -> PublicationStatus:
    normalized = _text(value).casefold()
    published = "\u0645\u0646\u062a\u0634\u0631"
    archived = "\u0628\u0627\u06cc\u06af\u0627\u0646\u06cc"
    if normalized == "published" or normalized.startswith(published):
        return PublicationStatus.PUBLISHED
    if normalized == "archived" or normalized.startswith(archived):
        return PublicationStatus.ARCHIVED
    return PublicationStatus.DRAFT


def parse_departure_date(value: Any) -> date:
    """Recognize year-first Gregorian, Jalali and native Excel dates consistently."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = _to_ascii_digits(_text(value))
    match = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
    if match:
        year, month, day = map(int, match.groups())
        if 1900 <= year <= 2200:
            try:
                return date(year, month, day)
            except ValueError:
                pass
        elif 1200 <= year <= 1700:
            return _jalali_to_gregorian(raw)
    raise ValueError(
        "تاریخ معتبر نیست؛ تاریخ شمسی مانند ۱۴۰۵/۰۶/۱۸ یا میلادی "
        "مانند 2026-09-09 وارد کنید."
    )


def _jalali_to_gregorian(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = _to_ascii_digits(_text(value)).replace("-", "/")
    parts = raw.split("/")
    if len(parts) != 3:
        raise ValueError("departure_date must be Jalali YYYY/MM/DD")
    jy, jm, jd = (int(part) for part in parts)
    if not 1200 <= jy <= 1700 or not 1 <= jm <= 12 or not 1 <= jd <= 31:
        raise ValueError("departure_date is outside the supported Jalali range")
    original = f"{jy:04d}/{jm:02d}/{jd:02d}"
    jy += 1595
    days = -355668 + 365 * jy + (jy // 33) * 8 + ((jy % 33 + 3) // 4) + jd
    days += (jm - 1) * 31 if jm < 7 else (jm - 7) * 30 + 186
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    leap = gy % 4 == 0 and (gy % 100 != 0 or gy % 400 == 0)
    month_days = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 1
    for length in month_days:
        if gd <= length:
            break
        gd -= length
        gm += 1
    result = date(gy, gm, gd)
    if _gregorian_to_jalali(result) != original:
        raise ValueError(f"تاریخ شمسی نامعتبر است: {original}")
    return result


def _gregorian_to_jalali(value: date) -> str:
    """Return an Excel-friendly Jalali YYYY/MM/DD value."""
    gy = value.year - 1600
    gm = value.month - 1
    gd = value.day - 1
    gregorian_month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gregorian_day_number = (
        365 * gy + (gy + 3) // 4 - (gy + 99) // 100 + (gy + 399) // 400
    )
    gregorian_day_number += sum(gregorian_month_days[:gm])
    is_leap = (gy + 1600) % 4 == 0 and (
        (gy + 1600) % 100 != 0 or (gy + 1600) % 400 == 0
    )
    if gm > 1 and is_leap:
        gregorian_day_number += 1
    jalali_day_number = gregorian_day_number + gd - 79
    cycles = jalali_day_number // 12053
    jalali_day_number %= 12053
    jy = 979 + 33 * cycles + 4 * (jalali_day_number // 1461)
    jalali_day_number %= 1461
    if jalali_day_number >= 366:
        jy += (jalali_day_number - 1) // 365
        jalali_day_number = (jalali_day_number - 1) % 365
    if jalali_day_number < 186:
        jm = 1 + jalali_day_number // 31
        jd = 1 + jalali_day_number % 31
    else:
        jm = 7 + (jalali_day_number - 186) // 30
        jd = 1 + (jalali_day_number - 186) % 30
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def build_tour_price_template(template_content: bytes) -> bytes:
    """Return the maintained tour-price workbook with headers only.

    Both the legacy code-based workbook and the name-based workbook are valid
    sources.  Keep any guide sheet supplied by the maintained name-based
    template so users can download the column instructions with the workbook.
    """
    workbook = load_workbook(BytesIO(template_content))
    sheet = workbook.active
    sheet.title = "IRT"
    if sheet.max_row > 1:
        sheet.delete_rows(2, sheet.max_row - 1)
    header_by_field = {
        field: column
        for column, cell in enumerate(sheet[1], start=1)
        for field, aliases in {
            **PRICE_HEADER_ALIASES,
            **OPTIONAL_PRICE_HEADER_ALIASES,
        }.items()
        if _normalized_header(cell.value)
        in {_normalized_header(alias) for alias in aliases}
    }
    if "extra_price" not in header_by_field:
        extra_column = sheet.max_column + 1
        sheet.cell(1, extra_column, "EXTRA")
        header_by_field["extra_price"] = extra_column
    no_bed_column = header_by_field.get("child_without_bed_price", 10)
    sheet.cell(1, no_bed_column).comment = Comment(
        "اگر قیمت کودک بدون تخت ارزی باشد، هزینه پرواز کودک با تخت نیز "
        "به آن افزوده می‌شود؛ قیمت تومانی کودک بدون تخت نهایی است.",
        "Jahan Bastan",
    )
    last_column = max(
        (column for column, cell in enumerate(sheet[1], start=1) if _text(cell.value)),
        default=sheet.max_column,
    )
    sheet.auto_filter.ref = f"A1:{get_column_letter(last_column)}1"
    sheet.freeze_panes = "A2"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _currency_for_cell(cell: Cell, fallback: str) -> str:
    raw = _text(cell.value)
    # Excel's [$...-locale] prefix is metadata, not a USD currency symbol.
    number_format = re.sub(
        r"\[\$([^\]-]*)(?:-[^\]]*)?\]", r"\1", _text(cell.number_format)
    )
    for source in (raw, number_format):
        currency_code = re.search(
            r"(?<![A-Z])(USD|EUR|TRY|GEL|IRR|IRT)(?![A-Z])", source.upper()
        )
        if currency_code:
            return currency_code.group(1)
        for symbol, code in CURRENCY_SYMBOLS.items():
            if symbol in source:
                return code
    return fallback


def _money(
    cell: Cell,
    fallback_currency: str,
    *,
    warnings: list[str] | None = None,
    formula_cell: Cell | None = None,
    header_row: int = 1,
) -> tuple[Decimal, str]:
    raw = cell.value
    currency = _currency_for_cell(cell, fallback_currency)
    missing_formula_result = (
        formula_cell is not None and formula_cell.data_type == "f" and raw is None
    )
    if (
        missing_formula_result
        or cell.data_type == "e"
        or _text(raw).casefold() in EXCEL_PRICE_ERRORS
    ):
        header = _text(cell.parent.cell(header_row, cell.column).value)
        problem = (
            "نتیجه فرمول در اکسل ذخیره نشده است"
            if missing_formula_result
            else f"خطای اکسل {raw}"
        )
        message = f"سلول {cell.coordinate}، ستون {header}: {problem}."
        if warnings is None:
            raise ValueError(f"{message} مبلغ صحیح را وارد کنید و دوباره ثبت کنید.")
        warnings.append(
            f"{message} این گزینه تا اصلاح قیمت ناموجود خواهد بود؛ "
            "سایر قیمت‌های معتبر ثبت می‌شوند."
        )
        # Zero is the existing unavailable-option marker; never a free price.
        return Decimal("0"), currency
    if raw is None:
        return Decimal("0"), currency
    if isinstance(raw, bool):
        raise ValueError(f"سلول {cell.coordinate}: قیمت باید عدد باشد، نه TRUE/FALSE.")
    if isinstance(raw, (int, float, Decimal)):
        amount = Decimal(str(raw))
    else:
        cleaned = _to_ascii_digits(_text(raw))
        if cleaned.casefold() in MISSING_PRICE_VALUES:
            return Decimal("0"), currency
        for symbol in CURRENCY_SYMBOLS:
            cleaned = cleaned.replace(symbol, "")
        cleaned = re.sub(r"(?i)USD|EUR|TRY|GEL|IRR|IRT", "", cleaned)
        cleaned = cleaned.replace("٬", "").replace("٫", ".")
        cleaned = re.sub(r"[,\s]", "", cleaned)
        try:
            amount = Decimal(cleaned)
        except InvalidOperation as exc:
            raise ValueError(
                f"سلول {cell.coordinate}: مبلغ «{raw}» قابل خواندن نیست؛ "
                "عدد یا عدد همراه با علامت ارز وارد کنید."
            ) from exc
    if not amount.is_finite():
        raise ValueError(f"invalid price in {cell.coordinate}: {raw}")
    if amount < 0:
        raise ValueError(
            f"سلول {cell.coordinate}: مبلغ منفی مجاز نیست؛ عدد صفر یا مثبت وارد کنید."
        )
    if amount > MAX_PRICE:
        raise ValueError(f"سلول {cell.coordinate}: مبلغ بیش از حد مجاز است.")
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), currency


def build_hotel_city_template(
    template_path: Path, destination: Destination, hotels: list[Hotel]
) -> bytes:
    workbook = load_workbook(template_path)
    aliases = {
        alias: key for key, values in HOTEL_HEADER_ALIASES.items() for alias in values
    }
    sheet, header_row, indexes = _import_sheet_and_headers(
        workbook, aliases, REQUIRED_HOTEL_COLUMNS
    )
    for cells in sheet.iter_rows(min_row=header_row + 1):
        for cell in cells:
            cell.value = None
    for row, hotel in enumerate(hotels, header_row + 1):
        values = {
            "hotel_code": hotel.hotel_code,
            "name": hotel.name,
            "destination": destination.slug,
            "city": destination.city,
            "address": hotel.address,
            "star_rating": hotel.star_rating,
            "service_grade": hotel.service_grade,
            "service_type": hotel.service_type,
            "default_room_type": hotel.default_room_type,
            "description": hotel.description,
            "hotel_policy": hotel.policies_description,
            "refund_policy": hotel.cancellation_policy,
            "status": hotel.status.value,
            "is_featured": hotel.is_featured,
        }
        for field, value in values.items():
            if field in indexes and value is not None:
                cell = sheet.cell(row, indexes[field] + 1, value)
                if isinstance(value, str):
                    cell.data_type = "s"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def parse_hotel_workbook(content: bytes) -> list[HotelImportRow]:
    workbook = _load_excel_workbook(content)
    aliases = {
        alias: key for key, values in HOTEL_HEADER_ALIASES.items() for alias in values
    }
    sheet, header_row, indexes = _import_sheet_and_headers(
        workbook, aliases, REQUIRED_HOTEL_COLUMNS
    )
    result: list[HotelImportRow] = []
    errors: list[dict[str, Any]] = []
    for row_number, cells in _import_data_rows(sheet, header_row, indexes):
        values = {key: cell.value for key, cell in cells.items()}
        if not any(_text(value) for value in values.values()):
            continue
        populated = {key for key, value in values.items() if _text(value)}
        if populated == {"name"} and re.search(
            r"(?i)commission|کمیسیون", _text(values["name"])
        ):
            # Agency sheets sometimes end with a commission note in column A.
            continue
        try:
            values["hotel_code"] = ""
            values["name"] = _text(values.get("name"))
            values["destination"] = _text(values.get("destination"))
            values["star_rating"] = _hotel_star_rating(values.get("star_rating"))
            if not all((values["name"], values["destination"])):
                raise ValueError("hotel_name and destination are required")
            result.append(HotelImportRow(row_number, values))
        except (TypeError, ValueError, InvalidOperation) as exc:
            errors.append({"row": row_number, "message": str(exc)})
    if errors:
        raise WorkbookValidationError(errors)
    if not result or len(result) > MAX_ROWS:
        raise WorkbookValidationError(
            [{"row": header_row, "message": "Workbook must have 1 to 500 rows."}]
        )
    return result


def _resolve_unnamed_room_offers(
    rows: list[PriceImportRow],
    unnamed_rows: set[int],
    blank_flights: dict[str, set[int]],
) -> list[PriceImportRow]:
    """Keep differently priced unnamed rooms distinct and inherit shared flights."""
    hotel_groups: dict[tuple[date, str], list[PriceImportRow]] = {}
    for row in rows:
        identity = _hotel_identity_key(row.hotel_name or row.hotel_code)
        hotel_groups.setdefault((row.departure_date, identity), []).append(row)
    resolved = {row.row_number: row for row in rows}
    for hotel_rows in hotel_groups.values():
        service_groups: dict[str, list[PriceImportRow]] = {}
        for row in hotel_rows:
            service_groups.setdefault(_hotel_name_key(row.service_type), []).append(row)
        for service_rows in service_groups.values():
            unnamed = [row for row in service_rows if row.row_number in unnamed_rows]
            signatures = {
                (
                    row.double_price,
                    row.double_currency,
                    row.single_price,
                    row.single_currency,
                    row.extra_price,
                    row.extra_currency,
                    row.child_with_bed_price,
                    row.child_with_bed_currency,
                )
                for row in unnamed
            }
            if len(unnamed) < 2 or len(signatures) < 2:
                continue
            used_labels = {
                _hotel_name_key(row.room_type)
                for row in service_rows
                if row.row_number not in unnamed_rows
            }
            number = 0
            for row in unnamed:
                while True:
                    number += 1
                    label = f"گزینه اتاق {number} (نام مشخص نشده)"
                    if _hotel_name_key(label) not in used_labels:
                        break
                used_labels.add(_hotel_name_key(label))
                resolved[row.row_number] = replace(
                    row,
                    room_type=label,
                    warnings=(
                        *row.warnings,
                        "نام نوع اتاق در فایل خالی است؛ "
                        f"این نرخ با عنوان «{label}» جداگانه ثبت می‌شود.",
                    ),
                )
        for field, currency_field in (
            ("flight_price_per_person", "flight_currency"),
            ("child_with_bed_flight_price", "child_with_bed_flight_currency"),
        ):
            blanks = blank_flights.get(field, set())
            supplied = {
                (getattr(row, field), getattr(row, currency_field))
                for row in hotel_rows
                if row.row_number not in blanks and getattr(row, field) is not None
            }
            if len(supplied) != 1:
                continue
            amount, currency = next(iter(supplied))
            for row in hotel_rows:
                if row.row_number in blanks:
                    resolved[row.row_number] = replace(
                        resolved[row.row_number],
                        **{field: amount, currency_field: currency},
                    )
    return [resolved[row.row_number] for row in rows]


def parse_price_workbook(
    content: bytes, default_currency: str | None = None
) -> list[PriceImportRow]:
    if default_currency is not None and default_currency not in {"IRT", "USD", "EUR"}:
        raise ValueError("Unsupported default currency")
    workbook = _load_excel_workbook(content)
    sheet, header_row, indexes = _import_sheet_and_headers(
        workbook,
        {**PRICE_HEADERS, **OPTIONAL_PRICE_HEADERS},
        REQUIRED_PRICE_COLUMNS,
    )
    if "hotel_code" not in indexes and "hotel_name" not in indexes:
        raise WorkbookValidationError(
            [
                {
                    "row": header_row,
                    "message": (
                        "یکی از ستون‌های hotel_name یا hotel_id باید وجود داشته باشد."
                    ),
                }
            ]
        )
    price_columns = {
        index + 1
        for field, index in indexes.items()
        if "price" in field and field not in {"external_price_code", "price_set_code"}
    }
    for merged in sorted(sheet.merged_cells.ranges, key=lambda item: item.min_row):
        if merged.max_row <= header_row or not any(
            merged.min_col <= column <= merged.max_col for column in price_columns
        ):
            continue
        raise WorkbookValidationError(
            [
                {
                    "row": max(merged.min_row, header_row + 1),
                    "message": (
                        f"سلول‌های قیمت {merged} ادغام شده‌اند؛ در تور معمولی هر "
                        "هتل باید قیمت مستقل داشته باشد. اگر فایل متعلق به تور "
                        "ترکیبی است، همان تور را انتخاب کنید و ترکیب هتل‌ها و "
                        "تعداد شب‌ها را در ویرایش تور تعریف کنید."
                    ),
                }
            ]
        )
    formula_sheet = _load_excel_workbook(content, data_only=False)[sheet.title]
    sheet_currency = sheet.title.strip().upper()
    package_fallback = default_currency or (
        sheet_currency if sheet_currency in SHEET_CURRENCIES else "IRT"
    )
    result: list[PriceImportRow] = []
    unnamed_rows: set[int] = set()
    blank_flights: dict[str, set[int]] = {}
    errors: list[dict[str, Any]] = []
    for row_number, mapped in _import_data_rows(sheet, header_row, indexes):
        if not any(_text(cell.value) for cell in mapped.values()):
            continue
        try:
            if "room_type" not in mapped or not _text(mapped["room_type"].value):
                unnamed_rows.add(row_number)
            for flight_field in (
                "flight_price_per_person",
                "child_with_bed_flight_price",
            ):
                cell = mapped.get(flight_field)
                if cell is not None and not _text(cell.value):
                    blank_flights.setdefault(flight_field, set()).add(row_number)
            warnings: list[str] = []
            text_values = {key: _text(cell.value) for key, cell in mapped.items()}
            hotel_code = text_values.get("hotel_code", "").upper()
            hotel_name = text_values.get("hotel_name", "")
            if not hotel_code and not hotel_name:
                raise ValueError("یکی از hotel_name یا hotel_id باید مقدار داشته باشد.")
            for key, limit in {
                "hotel_name": 180,
                "hotel_region": 120,
                "room_type": 80,
                "service_type": 40,
                "external_price_code": 64,
                "price_set_code": 64,
            }.items():
                if len(text_values.get(key, "")) > limit:
                    raise ValueError(f"{key}: حداکثر {limit} نویسه مجاز است.")
            package_fields = ("double_price", "single_price", "child_with_bed_price")
            package_values = [
                _money(
                    mapped[key],
                    package_fallback,
                    warnings=warnings,
                    formula_cell=formula_sheet[mapped[key].coordinate],
                    header_row=header_row,
                )
                if key in mapped
                else (Decimal(0), package_fallback)
                for key in package_fields
            ]
            if "child_with_bed_price" not in mapped:
                warnings.append(
                    "ستون کودک با تخت موجود نیست؛ این گزینه ناموجود می‌ماند "
                    "و تخت اضافه جداگانه ثبت می‌شود."
                )
            row_package_currency = next(
                (currency for amount, currency in package_values if amount > 0),
                package_values[0][1],
            )
            extra_cell = mapped.get("extra_price")
            extra_price, extra_currency = (
                _money(
                    extra_cell,
                    row_package_currency,
                    warnings=warnings,
                    formula_cell=formula_sheet[extra_cell.coordinate],
                    header_row=header_row,
                )
                if extra_cell is not None
                and (
                    _text(extra_cell.value)
                    or formula_sheet[extra_cell.coordinate].data_type == "f"
                )
                else (None, None)
            )
            no_bed, no_bed_currency = _money(
                mapped["child_without_bed_price"],
                default_currency or "IRT",
                warnings=warnings,
                formula_cell=formula_sheet[
                    mapped["child_without_bed_price"].coordinate
                ],
                header_row=header_row,
            )
            infant_cell = mapped.get("infant_price")
            infant, infant_currency = (
                _money(
                    infant_cell,
                    "IRT",
                    warnings=warnings,
                    formula_cell=formula_sheet[infant_cell.coordinate],
                    header_row=header_row,
                )
                if infant_cell is not None
                else (None, "IRT")
            )
            if infant_cell is None:
                warnings.append(
                    "ستون نوزاد موجود نیست؛ نرخ قبلی حفظ می‌شود و برای گزینه جدید "
                    "نرخ نوزاد نیاز به استعلام دارد."
                )
            flight_cell = mapped.get("flight_price_per_person")
            flight, flight_currency = (
                _money(
                    flight_cell,
                    "IRT",
                    formula_cell=formula_sheet[flight_cell.coordinate],
                    header_row=header_row,
                )
                if flight_cell is not None
                else (Decimal(0), "IRT")
            )
            if flight_cell is None:
                warnings.append(
                    "ستون نرخ پرواز موجود نیست؛ قیمت هر نوع تخت مبلغ نهایی است "
                    "و هزینه پرواز جداگانه اضافه نمی‌شود."
                )
            child_flight_cell = mapped.get("child_with_bed_flight_price")
            child_flight, child_flight_currency = (
                _money(
                    child_flight_cell,
                    "IRT",
                    formula_cell=formula_sheet[child_flight_cell.coordinate],
                    header_row=header_row,
                )
                if child_flight_cell is not None
                and (
                    formula_sheet[child_flight_cell.coordinate].data_type == "f"
                    or _text(child_flight_cell.value).casefold()
                    not in {"", "null", "none", "nan", "nil", "خالی", "نال"}
                )
                else (flight, flight_currency)
            )
            result.append(
                PriceImportRow(
                    row_number=row_number,
                    hotel_code=hotel_code,
                    departure_date=parse_departure_date(mapped["departure_date"].value),
                    hotel_name=hotel_name or None,
                    hotel_region=text_values.get("hotel_region") or None,
                    service_type=_text(mapped["service_type"].value) or "RO",
                    room_type=text_values.get("room_type") or "Standard",
                    external_price_code=(
                        _text(mapped["external_price_code"].value) or None
                        if "external_price_code" in mapped
                        else None
                    ),
                    price_set_code=(
                        _text(mapped["price_set_code"].value) or None
                        if "price_set_code" in mapped
                        else None
                    ),
                    is_base_package=_as_bool(mapped["is_base_package"].value)
                    if "is_base_package" in mapped
                    else False,
                    double_price=package_values[0][0],
                    single_price=package_values[1][0],
                    child_with_bed_price=package_values[2][0],
                    package_currency=row_package_currency,
                    double_currency=package_values[0][1],
                    single_currency=package_values[1][1],
                    child_with_bed_currency=package_values[2][1],
                    extra_price=extra_price,
                    extra_currency=extra_currency,
                    child_without_bed_price=no_bed,
                    child_without_bed_currency=no_bed_currency,
                    infant_price=infant,
                    infant_currency=infant_currency,
                    flight_price_per_person=flight,
                    flight_currency=flight_currency,
                    child_with_bed_flight_price=child_flight,
                    child_with_bed_flight_currency=child_flight_currency,
                    warnings=tuple(warnings),
                    flight_included_in_package=flight_cell is None,
                )
            )
        except (TypeError, ValueError) as exc:
            errors.append({"row": row_number, "message": str(exc)})
    if errors:
        raise WorkbookValidationError(errors)
    if not result or len(result) > MAX_ROWS:
        raise WorkbookValidationError(
            [{"row": 1, "message": "Workbook must contain 1 to 500 price rows."}]
        )
    return _resolve_unnamed_room_offers(result, unnamed_rows, blank_flights)


def _hotel_slug(code: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", code.casefold()).strip("-")
    if normalized != code.casefold():
        normalized = f"{normalized or 'import'}-{sha256(code.encode()).hexdigest()}"
    return f"hotel-{normalized}"


def _generated_hotel_code(destination_id: int, name: str) -> str:
    identity = f"{destination_id}:{_hotel_name_key(name)}"
    digest = sha256(identity.encode()).hexdigest()[:12].upper()
    return f"HTL-AUTO-{destination_id}-{digest}"


async def upsert_hotels(
    session: AsyncSession, rows: list[HotelImportRow], *, commit: bool
) -> dict[str, Any]:
    destinations = list(await session.scalars(select(Destination)))
    destination_by_key: dict[str, Destination | None] = {}
    destination_by_country_city: dict[tuple[str, str], list[Destination]] = {}
    for item in destinations:
        country_key = _destination_lookup_key(getattr(item, "country", None))
        if country_key:
            for city_key in {
                _destination_lookup_key(value)
                for value in (item.slug, item.title, getattr(item, "city", None))
                if _text(value)
            }:
                destination_by_country_city.setdefault(
                    (country_key, city_key), []
                ).append(item)
        for value in (item.slug, item.title, getattr(item, "city", None)):
            key = _destination_lookup_key(value)
            if not key:
                continue
            existing = destination_by_key.get(key)
            if key not in destination_by_key:
                destination_by_key[key] = item
            elif existing is not None and existing.id != item.id:
                # Ambiguous normalized destination keys are never selected.
                destination_by_key[key] = None
    existing = list(await session.scalars(select(Hotel)))
    hotels_by_identity: dict[tuple[int, str], Hotel | None] = {}
    for hotel in existing:
        key = (hotel.destination_id, _hotel_identity_key(hotel.name))
        hotels_by_identity[key] = None if key in hotels_by_identity else hotel
    imported_names: dict[tuple[int, str], str] = {}
    created = updated = skipped_duplicates = 0
    errors: list[dict[str, Any]] = []
    for row in rows:
        values = row.values
        destination_candidates = {
            item.id: item
            for key in _destination_lookup_keys(values["destination"])
            if (item := destination_by_key.get(key)) is not None
        }
        # Legacy workbooks put the country in destination and the city separately.
        # Require both to match; a city alone must never override a wrong country.
        if not destination_candidates:
            destination_candidates = {
                item.id: item
                for country_key in _destination_lookup_keys(values["destination"])
                for city_key in _destination_lookup_keys(values.get("city"))
                for item in destination_by_country_city.get((country_key, city_key), [])
            }
        destination = (
            next(iter(destination_candidates.values()))
            if len(destination_candidates) == 1
            else None
        )
        if destination is None:
            errors.append(
                {"row": row.row_number, "message": "destination does not exist"}
            )
            continue
        identity = (destination.id, _hotel_identity_key(values["name"]))
        address = _text(values.get("address")).casefold()
        if identity in imported_names:
            if imported_names[identity] != address:
                errors.append(
                    {
                        "row": row.row_number,
                        "message": "نام هتل با چند نشانی متفاوت در فایل آمده است.",
                    }
                )
            else:
                skipped_duplicates += 1
            continue
        imported_names[identity] = address
        if identity in hotels_by_identity and hotels_by_identity[identity] is None:
            errors.append(
                {
                    "row": row.row_number,
                    "message": "نام هتل در این مقصد تکراری است؛ "
                    "نام دقیق و یکتا ثبت کنید.",
                }
            )
            continue
        hotel = hotels_by_identity.get(identity)
        if hotel is None:
            resolved_code = _generated_hotel_code(destination.id, values["name"])
            hotel = Hotel(hotel_code=resolved_code, slug=_hotel_slug(resolved_code))
            session.add(hotel)
            hotels_by_identity[identity] = hotel
            created += 1
        else:
            updated += 1
        if not hotel.hotel_code:
            hotel.hotel_code = _generated_hotel_code(destination.id, values["name"])
        status = _publication_status(values.get("status"))
        summary = (
            _text(values.get("notes"))
            or f"{values['name']} hotel in {destination.title}"
        )
        description = (
            _text(values.get("description"))
            or "Complete information about "
            f"{values['name']} hotel in {destination.title}."
        )
        policies = [
            part
            for part in (
                _text(values.get("refund_policy")),
                _text(values.get("hotel_policy")),
            )
            if part
        ]
        candidate = {
            "destination_id": destination.id,
            "hotel_code": hotel.hotel_code,
            "name": values["name"],
            "slug": getattr(hotel, "slug", None) or _hotel_slug(hotel.hotel_code),
            "star_rating": values["star_rating"],
            "service_grade": _text(values.get("service_grade")) or None,
            "service_type": _text(values.get("service_type")) or None,
            "default_room_type": _text(values.get("default_room_type")) or None,
            "summary": summary,
            "description": description,
            "location_description": _text(values.get("address")) or None,
            "region": _text(values.get("region")) or None,
            "rooms_description": _text(values.get("default_room_type")) or None,
            "amenities_description": _text(values.get("amenities")) or None,
            "policies_description": "\n\n".join(policies) or None,
            "address": _text(values.get("address")) or None,
            "status": status,
            "is_featured": _as_bool(values.get("is_featured")),
        }
        try:
            validated = HotelWrite.model_validate(candidate)
        except ValidationError as exc:
            messages = "; ".join(
                error["msg"] for error in exc.errors(include_url=False)
            )
            errors.append({"row": row.row_number, "message": messages})
            continue
        for field in candidate:
            setattr(hotel, field, getattr(validated, field))
        hotel.published_at = (
            datetime.now(UTC) if status == PublicationStatus.PUBLISHED else None
        )
    if errors:
        await session.rollback()
        raise WorkbookValidationError(errors)
    if commit:
        await session.commit()
    else:
        await session.rollback()
    result = {"created": created, "updated": updated, "rows": len(rows)}
    if skipped_duplicates:
        result["skipped_duplicates"] = skipped_duplicates
    return result


_IMPORTED_ROOM_PRICE_FIELDS = (
    ("دو تخته", "double_price", "double_currency"),
    ("تک تخته", "single_price", "single_currency"),
    ("کودک با تخت", "child_with_bed_price", "child_with_bed_currency"),
    ("کودک بدون تخت", "child_without_bed_price", "child_without_bed_currency"),
)

_IMPORTED_ROOM_LABEL_ALIASES = {
    "dbl": "دو تخته",
    "sgl": "تک تخته",
    "chd w bed": "کودک با تخت",
    "child no bed": "کودک بدون تخت",
}


def _imported_room_prices(row: PriceImportRow) -> list[tuple[str, Decimal, str]]:
    """Return the four occupancy prices represented by the price workbook."""
    return [
        (
            label,
            getattr(row, price_field),
            getattr(row, currency_field) or row.package_currency,
        )
        for label, price_field, currency_field in _IMPORTED_ROOM_PRICE_FIELDS
    ]


async def _sync_imported_hotel_room_types(
    session: AsyncSession,
    rows: list[PriceImportRow],
    hotels_by_code: dict[str, Hotel],
) -> int:
    """Upsert the four visible occupancy price cards from Excel rows."""
    latest: dict[tuple[int, str], tuple[Hotel, str, Decimal, str]] = {}
    for row in rows:
        hotel = hotels_by_code.get(row.hotel_code)
        if hotel is None:
            continue
        room_prices = _imported_room_prices(row)
        if not any(price > 0 for _, price, _ in room_prices):
            continue
        hotel_id = getattr(hotel, "id", None)
        if hotel_id is None:
            continue
        for label, price, currency in room_prices:
            latest[(hotel_id, label.casefold())] = (hotel, label, price, currency)

    existing_by_key: dict[tuple[int, str], HotelRoom] = {}
    seen_hotels: set[int] = set()
    for hotel, _, _, _ in latest.values():
        hotel_id = hotel.id
        if hotel_id in seen_hotels:
            continue
        seen_hotels.add(hotel_id)
        try:
            rooms = hotel.room_types
        except Exception:
            rooms = []
        for room in rooms:
            canonical_name = _IMPORTED_ROOM_LABEL_ALIASES.get(
                room.name.casefold(), room.name
            )
            existing_by_key[(hotel_id, canonical_name.casefold())] = room

    room_order = {
        label.casefold(): index
        for index, (label, _, _) in enumerate(_IMPORTED_ROOM_PRICE_FIELDS)
    }
    synced = 0
    ordered = sorted(
        latest.values(),
        key=lambda item: (item[0].id, room_order.get(item[1].casefold(), 99)),
    )
    for hotel, label, price, currency in ordered:
        room_key = (hotel.id, label.casefold())
        room = existing_by_key.get(room_key)
        values = {
            "price_amount": price,
            "currency": currency,
            "display_order": room_order.get(label.casefold(), 99),
        }
        if room is None:
            session.add(
                HotelRoom(
                    hotel_id=hotel.id,
                    name=label,
                    **values,
                )
            )
        else:
            room.name = label
            room.price_amount = values["price_amount"]
            room.currency = values["currency"]
            room.display_order = values["display_order"]
        synced += 1
    return synced


async def load_tour_price_template_context(
    session: AsyncSession,
    tour_id: int,
) -> tuple[bool, list[date], list[Hotel]]:
    """Load all dated departures and hotels for a tour-price template."""
    tour_exists = await session.scalar(select(Tour.id).where(Tour.id == tour_id))
    if tour_exists is None:
        return False, [], []
    saved_dates = list(
        await session.scalars(
            select(TourDeparture.departure_date)
            .where(
                TourDeparture.tour_id == tour_id,
                TourDeparture.departure_date.is_not(None),
            )
            .order_by(TourDeparture.departure_date, TourDeparture.id)
        )
    )
    departure_dates = list(dict.fromkeys(saved_dates))
    hotels = list(
        await session.scalars(
            select(Hotel)
            .where(Hotel.status != PublicationStatus.ARCHIVED)
            .order_by(Hotel.name, Hotel.id)
            .limit(MAX_ROWS)
        )
    )
    return True, departure_dates, hotels


def _sync_tour_projection_from_import(
    tour: Tour,
    grouped_rows: dict[date, list[PriceImportRow]],
    departures_by_date: dict[date, TourDeparture],
    hotels_by_code: dict[str, Hotel],
) -> None:
    """Keep legacy tour listing fields aligned with imported structured prices."""
    if not grouped_rows:
        return

    for departure_date, date_rows in grouped_rows.items():
        base_row = next(
            (row for row in date_rows if row.is_base_package),
            date_rows[0],
        )
        departure = departures_by_date[departure_date]
        departure.price_amount = base_row.double_price
        departure.currency = base_row.double_currency or base_row.package_currency

    primary_date = min(grouped_rows)
    primary_rows = grouped_rows[primary_date]
    primary_row = next(
        (row for row in primary_rows if row.is_base_package),
        primary_rows[0],
    )
    primary_departure = departures_by_date[primary_date]
    primary_hotel = hotels_by_code[primary_row.hotel_code]

    tour.departure_date = primary_date
    tour.hotel_id = primary_hotel.id
    tour.hotel_name = primary_hotel.name
    tour.price_amount = primary_row.double_price
    tour.currency = primary_row.double_currency or primary_row.package_currency
    tour.flight_price_amount = primary_row.flight_price_per_person
    tour.flight_price_currency = primary_row.flight_currency

    return_date = getattr(primary_departure, "return_date", None)
    if return_date is not None:
        tour.return_date = return_date

    nights = getattr(primary_departure, "nights", None)
    if nights is not None:
        tour.stay_nights = nights
        tour.duration_days = nights + 1

    capacities = [
        capacity
        for departure in departures_by_date.values()
        if (capacity := getattr(departure, "capacity_total", None)) is not None
    ]
    if capacities:
        tour.max_passengers = max(capacities)

    flight_projection = {
        "outbound_airline_name": "airline_name",
        "outbound_airline_logo_image_id": "airline_logo_image_id",
        "outbound_origin_airport": "origin_airport",
        "outbound_origin_airport_code": "origin_airport_code",
        "outbound_destination_airport": "destination_airport",
        "outbound_destination_airport_code": "destination_airport_code",
        "outbound_flight_number": "flight_number",
        "outbound_departure_time": "departure_time",
        "outbound_arrival_time": "arrival_time",
        "outbound_baggage_allowance_kg": "baggage_allowance_kg",
        "outbound_aircraft_name": "aircraft_name",
        "outbound_travel_class": "travel_class",
        "return_airline_name": "return_airline_name",
        "return_airline_logo_image_id": "return_airline_logo_image_id",
        "return_origin_airport": "return_origin_airport",
        "return_origin_airport_code": "return_origin_airport_code",
        "return_destination_airport": "return_destination_airport",
        "return_destination_airport_code": "return_destination_airport_code",
        "return_flight_number": "return_flight_number",
        "return_departure_time": "return_departure_time",
        "return_arrival_time": "return_arrival_time",
        "return_baggage_allowance_kg": "return_baggage_allowance_kg",
        "return_aircraft_name": "return_aircraft_name",
        "return_travel_class": "return_travel_class",
    }
    for source_field, target_field in flight_projection.items():
        value = getattr(primary_departure, source_field, None)
        if value is not None:
            setattr(tour, target_field, value)


async def upsert_tour_departure_prices(
    session: AsyncSession,
    tour_id: int,
    rows: list[PriceImportRow],
    *,
    commit: bool,
    departure_id: int | None = None,
) -> dict[str, Any]:
    tour = await session.scalar(
        select(Tour).where(Tour.id == tour_id).with_for_update()
    )
    if tour is None:
        raise WorkbookValidationError(
            [{"row": 1, "message": "Selected tour was not found."}]
        )

    departures = list(
        await session.scalars(
            select(TourDeparture)
            .where(TourDeparture.tour_id == tour_id)
            .order_by(TourDeparture.display_order, TourDeparture.id)
        )
    )
    hotel_query = select(Hotel).options(selectinload(Hotel.room_types))
    if tour.destination_id is not None:
        hotel_query = hotel_query.where(Hotel.destination_id == tour.destination_id)
    hotels = list(await session.scalars(hotel_query))
    hotels_by_code: dict[str, Hotel] = {}
    hotels_by_name: dict[str, list[Hotel]] = {}
    for hotel in hotels:
        hotels_by_name.setdefault(_hotel_identity_key(hotel.name), []).append(hotel)
    created_hotels: list[Hotel] = []
    errors: list[dict[str, Any]] = []
    identity_warnings: list[dict[str, Any]] = []
    grouped_rows: dict[date, list[PriceImportRow]] = {}
    offer_keys: set[tuple[date, str, str, str]] = set()
    resolved_rows: list[PriceImportRow] = []
    for source_row in rows:
        row = source_row
        name = _text(row.hotel_name)
        matches = hotels_by_name.get(_hotel_identity_key(name), []) if name else []
        if len(matches) != 1:
            message = (
                "نام هتل باید در فایل وارد شود."
                if not name
                else f"نام هتل «{name}» در این مقصد تکراری است؛ "
                "نام دقیق و یکتا وارد کنید."
                if len(matches) > 1
                else f"هتل «{name}» در مقصد این تور پیدا نشد؛ "
                "ابتدا هتل را ثبت یا نام را اصلاح کنید."
            )
            errors.append({"row": row.row_number, "message": message})
            continue
        hotel = matches[0]
        # This key is internal only; uploaded IDs never select or rename a hotel.
        internal_key = f"saved-hotel-{hotel.id}"
        row = replace(row, hotel_code=internal_key)
        hotels_by_code[internal_key] = hotel
        resolved_rows.append(row)
        offer_key = (
            row.departure_date,
            row.hotel_code,
            *_offer_labels(row.room_type, row.service_type),
        )
        if offer_key in offer_keys:
            errors.append(
                {
                    "row": row.row_number,
                    "message": (
                        f"نرخ هتل «{name}» با اتاق «{row.room_type}» "
                        f"و خدمات «{row.service_type}» در این تاریخ تکراری است؛ "
                        "برای اتاق متفاوت، ستون نوع اتاق را جداگانه وارد کنید."
                    ),
                }
            )
        else:
            offer_keys.add(offer_key)
        grouped_rows.setdefault(row.departure_date, []).append(row)
    rows = resolved_rows
    for departure_date, date_rows in grouped_rows.items():
        if sum(row.is_base_package for row in date_rows) > 1:
            errors.append(
                {
                    "row": min(row.row_number for row in date_rows),
                    "message": (
                        "Only one base package is allowed for "
                        f"{departure_date.isoformat()}."
                    ),
                }
            )
    if errors:
        await session.rollback()
        raise WorkbookValidationError(errors)

    departures_by_date: dict[date, TourDeparture] = {}
    if departure_id is not None:
        target = next((item for item in departures if item.id == departure_id), None)
        if target is None or set(grouped_rows) != {target.departure_date}:
            raise WorkbookValidationError(
                [
                    {
                        "row": 1,
                        "message": (
                            "تاریخ فایل باید با تاریخ پکیج انتخابی این تور یکسان باشد."
                        ),
                    }
                ]
            )
    for departure in departures:
        if departure.departure_date is None:
            continue
        if departure_id is not None and departure.id != departure_id:
            continue
        if (
            departure.departure_date in grouped_rows
            and departure.departure_date in departures_by_date
        ):
            raise WorkbookValidationError(
                [
                    {
                        "row": grouped_rows[departure.departure_date][0].row_number,
                        "message": (
                            "این تاریخ چند پکیج دارد. تاریخ و مدت اقامت "
                            "پکیج را در پنل انتخاب کنید."
                        ),
                    }
                ]
            )
        departures_by_date.setdefault(departure.departure_date, departure)

    next_display_order = max(
        (departure.display_order for departure in departures),
        default=-1,
    )
    created_departures: list[TourDeparture] = []
    for departure_date, date_rows in grouped_rows.items():
        if departure_date in departures_by_date:
            continue
        next_display_order += 1
        departure = TourDeparture(
            tour_id=tour_id,
            label=(
                f"\u062a\u0627\u0631\u06cc\u062e {_gregorian_to_jalali(departure_date)}"
            ),
            departure_date=departure_date,
            currency=date_rows[0].double_currency or date_rows[0].package_currency,
            display_order=next_display_order,
        )
        session.add(departure)
        departures_by_date[departure_date] = departure
        created_departures.append(departure)

    if created_hotels or created_departures:
        await session.flush()

    synced_room_types = await _sync_imported_hotel_room_types(
        session, rows, hotels_by_code
    )

    affected_departure_ids: list[int] = []
    for departure_date in grouped_rows:
        departure_id = departures_by_date[departure_date].id
        if departure_id is None:
            raise RuntimeError("A tour departure was not assigned an id.")
        affected_departure_ids.append(departure_id)

    existing_prices = await load_departure_prices_for_import(
        session, affected_departure_ids
    )
    existing_by_key = {
        (
            price.departure_id,
            price.hotel_id,
            *_offer_labels(price.room_type, price.service_type),
        ): price
        for price in existing_prices
    }
    # Release the unique base-package slot before assigning the new base row.
    had_base_package = any(price.is_base_package for price in existing_prices)
    for price in existing_prices:
        price.is_base_package = False
    if had_base_package:
        await session.flush()
    retained_ids: set[int] = set()
    for departure_date, date_rows in grouped_rows.items():
        departure_id = departures_by_date[departure_date].id
        for display_order, row in enumerate(date_rows):
            hotel = hotels_by_code[row.hotel_code]
            room_type = row.room_type or hotel.default_room_type or "Standard"
            service_type = row.service_type or hotel.service_type or "RO"
            key = (
                departure_id,
                hotel.id,
                *_offer_labels(room_type, service_type),
            )
            price = existing_by_key.get(key)
            if price is None:
                price = TourDepartureHotelPrice(
                    departure_id=departure_id, hotel_id=hotel.id
                )
                session.add(price)
            else:
                retained_ids.add(price.id)
                if price.is_available is False or price.capacity_remaining == 0:
                    identity_warnings.append(
                        {
                            "row": row.row_number,
                            "message": f"قیمت هتل «{row.hotel_name}» ثبت می‌شود؛ "
                            "این نرخ "
                            "قبلاً غیرفعال یا تکمیل ظرفیت شده است؛ برای نمایش، "
                            "وضعیت و ظرفیت نرخ را در مدیریت تور بررسی کنید.",
                        }
                    )
            # Preserve capacity, availability and references held by carts/bookings.
            price.room_type = room_type
            price.service_type = service_type
            if row.external_price_code is not None:
                price.external_price_code = row.external_price_code
            if row.price_set_code is not None:
                price.price_set_code = row.price_set_code
            price.is_base_package = row.is_base_package
            for field in (
                "double_price",
                "single_price",
                "child_with_bed_price",
                "package_currency",
                "double_currency",
                "single_currency",
                "child_with_bed_currency",
                "extra_price",
                "extra_currency",
                "child_without_bed_price",
                "child_without_bed_currency",
                "infant_price",
                "infant_currency",
                "flight_price_per_person",
                "flight_currency",
                "child_with_bed_flight_price",
                "child_with_bed_flight_currency",
            ):
                if field == "infant_price" and row.infant_price is None:
                    if price.infant_price is None:
                        price.infant_price = Decimal(0)
                    continue
                if field == "infant_currency" and row.infant_price is None:
                    if price.infant_currency is None:
                        price.infant_currency = row.infant_currency
                    continue
                setattr(price, field, getattr(row, field))
            # The workbook is authoritative for these dated offers. Clear old
            # per-occupancy overrides so the newly imported shared flight applies.
            price.double_flight_price = None
            price.single_flight_price = None
            if row.flight_included_in_package:
                # A final package amount must not inherit old flight surcharges.
                price.double_flight_price = Decimal(0)
                price.single_flight_price = Decimal(0)
                price.child_with_bed_flight_price = Decimal(0)
                price.child_with_bed_flight_currency = row.package_currency
            price.display_order = display_order
    # Removed offers must stop selling without cascading deletions into carts.
    for price in existing_prices:
        if price.id not in retained_ids:
            price.is_available = False

    _sync_tour_projection_from_import(
        tour,
        grouped_rows,
        departures_by_date,
        hotels_by_code,
    )

    await refresh_tour_card_price(session, tour)

    if commit:
        await session.commit()
    else:
        await session.rollback()
    created_count = len(created_departures)
    return {
        "rows": len(rows),
        "replaced": len(rows),
        "dates": len(grouped_rows),
        "createdDepartures": created_count,
        "reusedDepartures": len(grouped_rows) - created_count,
        "createdHotels": len(created_hotels),
        "syncedRoomTypes": synced_room_types,
        "departureIds": affected_departure_ids,
        "tourId": tour_id,
        "departureDates": [day.isoformat() for day in grouped_rows],
        "retiredPrices": len(existing_prices) - len(retained_ids),
        "warnings": identity_warnings
        + [
            {"row": row.row_number, "message": message}
            for row in rows
            for message in row.warnings
        ],
    }
