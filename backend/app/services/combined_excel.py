"""Read shared (merged or repeated) prices for existing multi-hotel stays."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from openpyxl.cell.cell import Cell
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TourCombinedDeparturePrice, TourCombinedPackage, TourDeparture
from app.repositories.combined_excel import (
    load_combined_import_context,
    load_combined_prices,
)
from app.repositories.tour_card_price import refresh_tour_card_price
from app.services.combined_hotel_names import combined_hotel_key
from app.services.excel_pricing import (
    EXCEL_PRICE_ERRORS,
    MAX_ROWS,
    MISSING_PRICE_VALUES,
    OPTIONAL_PRICE_HEADERS,
    PRICE_HEADERS,
    WorkbookValidationError,
    _gregorian_to_jalali,
    _import_data_rows,
    _import_sheet_and_headers,
    _load_excel_workbook,
    _money,
    _text,
    parse_departure_date,
)

NULL_VALUES = MISSING_PRICE_VALUES | {
    "null",
    "none",
    "nan",
    "nil",
    "خالی",
    "نال",
    "ناموجود",
}
PRICE_FIELDS = {
    "double_price": "double",
    "single_price": "single",
    "child_with_bed_price": "child_with_bed",
    "child_without_bed_price": "child_without_bed",
    "infant_price": "infant",
    "flight_price_per_person": "regular_flight",
    "child_with_bed_flight_price": "child_with_bed_flight",
    "extra_price": "extra",
}
HEADERS = {
    **PRICE_HEADERS,
    **OPTIONAL_PRICE_HEADERS,
    **dict.fromkeys(("nights", "تعداد شب", "شب"), "nights"),
    **dict.fromkeys(
        ("loc", "location", "region", "منطقه", "موقعیت", "موقعیت هتل"), "region"
    ),
    **dict.fromkeys(
        (
            "flight child w bed",
            "flight child with bed",
            "child_with_bed_flight_price",
            "پرواز کودک با تخت",
            "هزینه پرواز کودک با تخت",
            "قیمت پرواز کودک با تخت",
            "پرواز کودک",
            "هزینه پرواز کودک",
        ),
        "child_with_bed_flight_price",
    ),
}


@dataclass(frozen=True)
class CombinedHotelRow:
    row_number: int
    hotel_code: str
    hotel_name: str | None
    service_type: str | None
    room_type: str | None
    region: str | None
    nights: int | None = None


@dataclass(frozen=True)
class CombinedImportRow:
    row_number: int
    departure_date: date
    hotels: tuple[CombinedHotelRow, ...]
    prices: dict[str, Decimal | str | None]
    warnings: tuple[dict[str, Any], ...] = ()


def _nullable_text(value: Any) -> str | None:
    raw = _text(value)
    return None if raw.casefold() in NULL_VALUES else raw


def _stay_nights(value: str | None) -> int | None:
    if not value:
        return None
    try:
        number = int(value)
    except ValueError as exc:
        raise ValueError("تعداد شب باید عدد صحیح باشد.") from exc
    if not 1 <= number <= 365:
        raise ValueError("تعداد شب باید بین ۱ تا ۳۶۵ باشد.")
    return number


def has_combined_stay_columns(content: bytes) -> bool:
    workbook = _load_excel_workbook(content)
    try:
        return any(
            _text(cell.value).strip().casefold() in {"nights", "تعداد شب", "شب"}
            for sheet in workbook
            for row in sheet.iter_rows(max_row=10)
            for cell in row
        )
    finally:
        workbook.close()


def _infant_components(cell: Cell) -> tuple[Decimal, str, Decimal, str] | None:
    """Read a local amount plus an explicitly marked foreign amount, without FX."""
    raw = str(cell.value or "").replace("＋", "+")
    if "+" not in raw:
        return None
    parts = raw.split("+")
    if len(parts) != 2 or not all(part.strip() for part in parts):
        raise ValueError(
            f"سلول {cell.coordinate}: قیمت ترکیبی نوزاد باید دو مبلغ داشته باشد."
        )
    amounts = []
    for part in parts:
        # Do not inherit the original cell's display currency for either component.
        temporary = Cell(cell.parent, row=cell.row, column=cell.column, value=part)
        amounts.append(_money(temporary, "IRT"))
    local = [item for item in amounts if item[1] == "IRT"]
    foreign = [item for item in amounts if item[1] in {"USD", "EUR", "TRY", "GEL"}]
    if len(local) != 1 or len(foreign) != 1:
        raise ValueError(
            f"سلول {cell.coordinate}: قیمت نوزاد باید شامل یک مبلغ تومان "
            "و یک مبلغ با علامت ارز باشد."
        )
    return *foreign[0], *local[0]


def parse_combined_workbook(
    content: bytes, default_currency: str | None = None
) -> list[CombinedImportRow]:
    """Each merged price span is a package; unmerged templates use row pairs."""
    workbook = _load_excel_workbook(content)
    formulas = _load_excel_workbook(content, data_only=False)
    try:
        sheet, header_row, headers = _import_sheet_and_headers(
            workbook, HEADERS, {"departure_date", "double_price"}
        )
        if "hotel_code" not in headers and "hotel_name" not in headers:
            raise WorkbookValidationError(
                [
                    {
                        "row": header_row,
                        "message": (
                            "یکی از ستون‌های hotel_name یا hotel_id باید "
                            "وجود داشته باشد."
                        ),
                    }
                ]
            )
        formula_sheet = formulas[sheet.title]
        errors: list[dict[str, Any]] = []
        price_columns = {
            headers[field] + 1 for field in PRICE_FIELDS if field in headers
        }
        merged_cells: dict[tuple[int, int], tuple[int, int]] = {}
        spans: dict[int, tuple[int, int]] = {}
        for merged in sheet.merged_cells.ranges:
            if merged.max_row <= header_row:
                continue
            recognized = set(range(merged.min_col, merged.max_col + 1)) & {
                i + 1 for i in headers.values()
            }
            if not recognized:
                continue
            if merged.min_col != merged.max_col or merged.min_row <= header_row:
                errors.append(
                    {
                        "row": merged.min_row,
                        "message": (
                            "ادغام افقی ستون‌های اطلاعات پشتیبانی نمی‌شود؛ هر ستون "
                            "باید مقدار مستقل داشته باشد."
                        ),
                    }
                )
                continue
            for row_number in range(merged.min_row, merged.max_row + 1):
                merged_cells[row_number, merged.min_col] = (
                    merged.min_row,
                    merged.min_col,
                )
                if merged.min_col in price_columns:
                    span = (merged.min_row, merged.max_row)
                    if row_number in spans and spans[row_number] != span:
                        errors.append(
                            {
                                "row": row_number,
                                "message": (
                                    "محدوده ادغام ستون‌های قیمت یکسان نیست؛ "
                                    "هر ادغام باید "
                                    "دقیقاً هتل‌های یک ترکیب را پوشش دهد."
                                ),
                            }
                        )
                    spans[row_number] = span
        if errors:
            raise WorkbookValidationError(errors)

        def cell_at(number: int, field: str) -> Any:
            column = headers[field] + 1
            # Never inherit hotel identities from merged cells.
            coordinate = (
                (number, column)
                if field in {"hotel_code", "hotel_name"}
                else merged_cells.get((number, column), (number, column))
            )
            return sheet.cell(*coordinate)

        active_rows = [
            number
            for number, _ in _import_data_rows(formula_sheet, header_row, headers)
            if any(
                _nullable_text(sheet.cell(number, index + 1).value) is not None
                or formula_sheet.cell(number, index + 1).data_type == "f"
                for index in headers.values()
            )
        ]
        if not active_rows or len(active_rows) > MAX_ROWS:
            raise WorkbookValidationError(
                [
                    {
                        "row": header_row,
                        "message": (
                            f"فایل باید بین ۱ و {MAX_ROWS} ردیف اطلاعات داشته باشد."
                        ),
                    }
                ]
            )
        groups: list[list[int]] = []
        index = 0
        while index < len(active_rows):
            start = active_rows[index]
            if start in spans:
                first, last = spans[start]
                numbers = list(range(first, last + 1))
                if (
                    start != first
                    or active_rows[index : index + len(numbers)] != numbers
                ):
                    errors.append(
                        {
                            "row": start,
                            "message": (
                                "در محدوده ادغام قیمت، ردیف هتل خالی یا ناقص است."
                            ),
                        }
                    )
                    break
            else:
                numbers = active_rows[index : index + 2]
                if len(numbers) != 2 or numbers[1] != start + 1 or numbers[1] in spans:
                    errors.append(
                        {
                            "row": start,
                            "message": (
                                "هر ترکیب باید دو ردیف متوالی هتل داشته باشد؛ برای بیش "
                                "از دو هتل، قیمت‌ها را روی ردیف‌های همان ترکیب ادغام "
                                "کنید."
                            ),
                        }
                    )
                    break
            if not 2 <= len(numbers) <= 20:
                errors.append(
                    {
                        "row": start,
                        "message": "هر ترکیب باید بین ۲ تا ۲۰ هتل داشته باشد.",
                    }
                )
            groups.append(numbers)
            index += len(numbers)
        parsed: list[CombinedImportRow] = []
        for numbers in groups:
            try:
                dates = {
                    parse_departure_date(cell_at(n, "departure_date").value)
                    for n in numbers
                    if _nullable_text(cell_at(n, "departure_date").value) is not None
                }
                if len(dates) != 1:
                    raise ValueError(
                        "تاریخ حرکت هتل‌های هر ترکیب باید یکسان و دست‌کم در یک "
                        "ردیف وارد شده باشد."
                    )
                hotels: list[CombinedHotelRow] = []
                warnings: list[dict[str, Any]] = []
                for number in numbers:
                    values = {
                        field: _nullable_text(cell_at(number, field).value)
                        for field in headers
                        if field not in PRICE_FIELDS
                    }
                    code = ""
                    name = values.get("hotel_name")
                    if not code and not name:
                        raise ValueError(
                            f"ردیف {number}: نام هتل یا شناسه هتل باید وارد شود."
                        )
                    if len(code) > 64:
                        raise ValueError(f"ردیف {number}: شناسه هتل بیش از ۶۴ حرف است.")
                    if name and len(name) > 180:
                        raise ValueError(f"ردیف {number}: نام هتل بیش از ۱۸۰ حرف است.")
                    service = values.get("service_type")
                    if service:
                        service = (
                            re.sub(r"^\s*[1-5۱-۵]\s*[*★]\s*", "", service)
                            .strip()
                            .upper()
                        )
                        if len(service) > 40:
                            raise ValueError(
                                f"ردیف {number}: نوع خدمات بیش از ۴۰ حرف است."
                            )
                    hotels.append(
                        CombinedHotelRow(
                            number,
                            code,
                            name,
                            service or None,
                            values.get("room_type"),
                            values.get("region"),
                            _stay_nights(values.get("nights")),
                        )
                    )
                identities = {
                    (
                        "code",
                        hotel.hotel_code,
                    )
                    if hotel.hotel_code
                    else ("name", combined_hotel_key(hotel.hotel_name or ""))
                    for hotel in hotels
                }
                if len(identities) != len(hotels):
                    raise ValueError("هتل در یک ترکیب تکرار شده است.")
                prices: dict[str, Decimal | str | None] = {}
                infant_components: set[tuple[Decimal, str, Decimal, str]] = set()
                plain_infant = False
                prices["infant_supplement_price"] = None
                prices["infant_supplement_currency"] = "IRT"
                for field, target in PRICE_FIELDS.items():
                    amounts: set[tuple[Decimal, str]] = set()
                    checked: set[str] = set()
                    unavailable = False
                    for number in numbers if field in headers else []:
                        cell = cell_at(number, field)
                        if cell.coordinate in checked:
                            continue
                        checked.add(cell.coordinate)
                        formula = formula_sheet[cell.coordinate]
                        invalid = (
                            cell.data_type == "e"
                            or _text(cell.value).casefold() in EXCEL_PRICE_ERRORS
                            or (formula.data_type == "f" and cell.value is None)
                        )
                        if not invalid and _nullable_text(cell.value) is None:
                            continue
                        messages: list[str] = []
                        components = (
                            _infant_components(cell)
                            if target == "infant" and not invalid
                            else None
                        )
                        if components is not None:
                            infant_components.add(components)
                            amount, currency = components[:2]
                        else:
                            amount, currency = _money(
                                cell,
                                (default_currency or "IRT")
                                if target
                                in {
                                    "double",
                                    "single",
                                    "child_with_bed",
                                    "child_without_bed",
                                    "extra",
                                }
                                else "IRT",
                                warnings=None if "flight" in target else messages,
                                formula_cell=formula,
                                header_row=header_row,
                            )
                            if target == "infant":
                                plain_infant = True
                        if messages:
                            unavailable = True
                            warnings.extend(
                                {"row": number, "message": message}
                                for message in messages
                            )
                        else:
                            amounts.add((amount, currency))
                    if len(amounts) > 1:
                        raise ValueError(
                            f"قیمت یا ارز ستون {field} بین هتل‌های ترکیب متفاوت است؛ "
                            "قیمت باید متعلق به کل ترکیب و یکسان باشد."
                        )
                    amount, currency = next(iter(amounts), (None, "IRT"))
                    prices[f"{target}_price"] = None if unavailable else amount
                    prices[f"{target}_currency"] = currency
                    if target == "infant" and infant_components:
                        if (
                            len(infant_components) != 1
                            or len(amounts) != 1
                            or plain_infant
                        ):
                            raise ValueError(
                                "قیمت ترکیبی نوزاد بین هتل‌های ترکیب متفاوت است."
                            )
                        _, _, supplement, supplement_currency = next(
                            iter(infant_components)
                        )
                        prices["infant_supplement_price"] = supplement
                        prices["infant_supplement_currency"] = supplement_currency
                if prices["child_with_bed_flight_price"] is None:
                    prices["child_with_bed_flight_price"] = prices[
                        "regular_flight_price"
                    ]
                    prices["child_with_bed_flight_currency"] = prices[
                        "regular_flight_currency"
                    ]
                parsed.append(
                    CombinedImportRow(
                        numbers[0],
                        next(iter(dates)),
                        tuple(hotels),
                        prices,
                        tuple(warnings),
                    )
                )
            except ValueError as exc:
                errors.append({"row": numbers[0], "message": str(exc)})
        if errors:
            raise WorkbookValidationError(errors)
        return parsed
    finally:
        workbook.close()
        formulas.close()


def _matching_assignments(
    row: CombinedImportRow, package: TourCombinedPackage
) -> dict[int, Any] | None:
    """Prefer unique names; accept exact hotel codes for abbreviated names."""
    if len(row.hotels) != len(package.hotels):
        return None
    remaining = list(package.hotels)
    result: dict[int, Any] = {}
    for imported_hotel in row.hotels:
        name_candidates = [
            assignment
            for assignment in remaining
            if imported_hotel.hotel_name
            and combined_hotel_key(assignment.hotel.name)
            == combined_hotel_key(imported_hotel.hotel_name)
        ]
        candidates = name_candidates
        if not candidates and imported_hotel.hotel_code:
            candidates = [
                assignment
                for assignment in remaining
                if assignment.hotel.hotel_code == imported_hotel.hotel_code
            ]
        if len(candidates) != 1:
            return None
        assignment = candidates[0]
        result[imported_hotel.row_number] = assignment
        remaining.remove(assignment)
    return result if not remaining else None


def _resolve_hotel_price_currencies(
    row: CombinedImportRow, package: TourCombinedPackage
) -> tuple[dict[str, Decimal | str | None], set[str]]:
    """Use the configured hotel currency for unmarked legacy price cells."""
    prices = dict(row.prices)
    inferred: set[str] = set()
    for field in (
        "double",
        "single",
        "child_with_bed",
        "child_without_bed",
        "extra",
    ):
        if prices.get(f"{field}_price") is None:
            continue
        configured = getattr(package, f"{field}_currency", "IRT")
        if prices.get(f"{field}_currency") == "IRT" and configured in {"USD", "EUR"}:
            prices[f"{field}_currency"] = configured
            inferred.add(configured)
    return prices, inferred


async def upsert_combined_prices(
    session: AsyncSession,
    tour_id: int,
    rows: list[CombinedImportRow],
    *,
    commit: bool,
    departure_id: int | None = None,
) -> dict[str, Any]:
    tour, packages, departures = await load_combined_import_context(session, tour_id)
    if tour is None:
        raise WorkbookValidationError(
            [
                {
                    "row": 1,
                    "message": (
                        "ابتدا ترکیب هتل‌ها و تعداد شب هر اقامت را در ویرایش "
                        "همین تور تعریف کنید."
                    ),
                }
            ]
        )
    from app.services.combined_stay_setup import prepare_stays

    selected = None
    if departure_id is not None:
        selected = next((item for item in departures if item.id == departure_id), None)
        if (
            selected is None
            or not rows
            or any(row.departure_date != selected.departure_date for row in rows)
        ):
            raise WorkbookValidationError(
                [
                    {
                        "row": 1,
                        "message": (
                            "تاریخ فایل باید با پکیج انتخابی همین تور یکسان باشد."
                        ),
                    }
                ]
            )

    created_packages = await prepare_stays(session, tour_id, rows, packages)
    if created_packages:
        tour.is_combined_stay = True
        await session.flush()
    errors: list[dict[str, Any]] = []
    warnings = [warning for row in rows for warning in row.warnings]
    matched: list[
        tuple[
            CombinedImportRow,
            TourCombinedPackage,
            dict[int, Any],
            dict[str, Decimal | str | None],
        ]
    ] = []
    seen: set[tuple[int, date]] = set()
    for row in rows:
        candidates = [
            (package, assignments)
            for package in packages
            if (assignments := _matching_assignments(row, package)) is not None
        ]
        if len(candidates) != 1:
            message = (
                (
                    "این ترکیب هتل در تور انتخاب‌شده تعریف نشده است؛ ابتدا "
                    "ترکیب و تعداد شب‌ها را در ویرایش تور ثبت کنید."
                )
                if not candidates
                else (
                    "چند ترکیب با همین شناسه‌های هتل تعریف شده است؛ ابتدا "
                    "ترکیب تکراری را در ویرایش تور اصلاح کنید."
                )
            )
            errors.append({"row": row.row_number, "message": message})
            continue
        package, assignments = candidates[0]
        if (
            selected
            and selected.nights
            and sum(item.nights for item in package.hotels) != selected.nights
        ):
            errors.append(
                {
                    "row": row.row_number,
                    "message": (
                        "مجموع شب‌های ترکیب هتل‌ها با مدت اقامت پکیج انتخابی متفاوت است."
                    ),
                }
            )
            continue
        if any(
            hotel.nights is not None
            and hotel.nights != assignments[hotel.row_number].nights
            for hotel in row.hotels
        ):
            errors.append(
                {
                    "row": row.row_number,
                    "message": (
                        "تعداد شب فایل با اقامت موجود متفاوت است؛ برای حفظ قیمت "
                        "تاریخ‌های دیگر، تغییر اقامت باید جداگانه بررسی شود."
                    ),
                }
            )
            continue
        resolved_prices, inferred_currencies = _resolve_hotel_price_currencies(
            row, package
        )
        if inferred_currencies:
            warnings.append(
                {
                    "row": row.row_number,
                    "message": (
                        "علامت ارز نرخ هتل در فایل خالی بود؛ ارز تنظیم‌شده ترکیب "
                        f"({', '.join(sorted(inferred_currencies))}) اعمال شد."
                    ),
                }
            )
        key = (package.id, row.departure_date)
        if key in seen:
            errors.append(
                {
                    "row": row.row_number,
                    "message": (
                        "یک ترکیب برای همین تاریخ بیش از یک‌بار در فایل آمده است."
                    ),
                }
            )
        seen.add(key)
        for hotel in row.hotels:
            actual = assignments[hotel.row_number].hotel
            if hotel.hotel_code and hotel.hotel_code != actual.hotel_code:
                warnings.append(
                    {
                        "row": hotel.row_number,
                        "message": (
                            f"شناسه قدیمی {hotel.hotel_code} با هتل «{actual.name}» "
                            "یکسان نیست؛ هتل با نام فایل تطبیق داده شد."
                        ),
                    }
                )
            if hotel.room_type or hotel.region:
                warnings.append(
                    {
                        "row": hotel.row_number,
                        "message": (
                            "منطقه و نوع اتاق در این قالب اطلاعات کمکی هستند؛ مشخصات "
                            "اصلی هتل و ترکیب از تنظیمات سایت حفظ می‌شود."
                        ),
                    }
                )
        matched.append((row, package, assignments, resolved_prices))
    by_date: dict[date, TourDeparture] = {}
    for departure in departures:
        if selected and departure.id != selected.id:
            continue
        if departure.departure_date is not None:
            if departure.departure_date in by_date and any(
                row.departure_date == departure.departure_date for row in rows
            ):
                errors.append(
                    {
                        "row": 1,
                        "message": (
                            "برای یک تاریخ چند نوبت در تور تعریف شده است؛ پیش از "
                            "ورود، نوبت تکراری را اصلاح کنید."
                        ),
                    }
                )
            by_date[departure.departure_date] = departure
    if len(set(by_date) | {row.departure_date for row in rows}) > 100:
        errors.append(
            {"row": 1, "message": "تعداد تاریخ‌های تور نباید بیشتر از ۱۰۰ باشد."}
        )
    if errors:
        await session.rollback()
        raise WorkbookValidationError(errors)
    created = 0
    next_order = max((item.display_order for item in departures), default=-1) + 1
    for row, package, _assignments, _resolved_prices in matched:
        if row.departure_date not in by_date:
            nights = sum(item.nights for item in package.hotels)
            departure = TourDeparture(
                tour_id=tour_id,
                label=f"تاریخ {_gregorian_to_jalali(row.departure_date)}",
                departure_date=row.departure_date,
                return_date=row.departure_date + timedelta(days=nights),
                nights=nights,
                currency="IRT",
                display_order=next_order,
            )
            session.add(departure)
            by_date[row.departure_date] = departure
            created += 1
            next_order += 1
    if created:
        await session.flush()
    existing = await load_combined_prices(
        session,
        [item.id for item in packages],
        [by_date[row.departure_date].id for row in rows],
    )
    existing_by_key = {(item.package_id, item.departure_id): item for item in existing}
    previews: list[dict[str, Any]] = []
    for row, package, assignments, resolved_prices in matched:
        departure = by_date[row.departure_date]
        key = (package.id, departure.id)
        price = existing_by_key.get(key)
        if price is None:
            price = TourCombinedDeparturePrice(
                package_id=package.id, departure_id=departure.id
            )
            session.add(price)
        for field, value in resolved_prices.items():
            setattr(price, field, value)
        # This import only changes dated prices, never the definition of a stay.
        for hotel in row.hotels:
            assignment = assignments[hotel.row_number]
            if (
                hotel.service_type
                and hotel.service_type != (assignment.board_type or "").upper()
            ):
                warnings.append(
                    {
                        "row": hotel.row_number,
                        "message": (
                            f"خدمات فایل «{hotel.service_type}» با خدمات ترکیب "
                            f"«{assignment.board_type or 'خالی'}» متفاوت است؛ "
                            "تنظیمات اقامت حفظ می‌شود."
                        ),
                    }
                )
        previews.append(
            {
                "row": row.row_number,
                "title": package.title,
                "departureDate": row.departure_date.isoformat(),
                "hotels": [
                    {
                        "name": item.hotel.name,
                        "nights": item.nights,
                        "service": item.board_type,
                    }
                    for item in package.hotels
                ],
                "prices": resolved_prices,
            }
        )
    # Seed the legacy listing date only when missing; retain manually set tour data.
    if tour.departure_date is None:
        tour.departure_date = min(row.departure_date for row in rows)
    await session.flush()
    await refresh_tour_card_price(session, tour, combined=True)
    if commit:
        await session.commit()
    else:
        await session.rollback()
    return {
        "rows": sum(len(row.hotels) for row in rows),
        "packages": len(rows),
        "createdDepartures": created,
        "createdPackages": created_packages,
        "warnings": warnings,
        "combinations": previews,
    }
