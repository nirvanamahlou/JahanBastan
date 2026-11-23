"""Generate concise, right-to-left PDF packages for tours."""
# ruff: noqa: E501

from __future__ import annotations

import re
from datetime import datetime
from html import escape, unescape
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import arabic_reshaper
from anyio import to_thread
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tour_stage_types import normalize_tour_stage_type
from app.models import Tour
from app.services.excel_pricing import _gregorian_to_jalali

_TAG_PATTERN = re.compile(r"<[^>]+>")
_BREAK_PATTERN = re.compile(r"<\s*br\s*/?\s*>", re.IGNORECASE)
_PARAGRAPH_PATTERN = re.compile(r"</\s*p\s*>", re.IGNORECASE)
_FONT_NAME = "Samim"
_BOLD_FONT_NAME = "Samim-Bold"
_MUTED = colors.HexColor("#5B6B84")
_NAVY = colors.HexColor("#073B82")
_LIGHT_BLUE = colors.HexColor("#F7FAFF")
_BORDER = colors.HexColor("#C9D9F0")
_TEHRAN_TIMEZONE = ZoneInfo("Asia/Tehran")


def _font_path(name: str) -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "fonts" / name


def _register_fonts() -> None:
    if _FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(_FONT_NAME, str(_font_path("Samim.ttf"))))
        pdfmetrics.registerFont(
            TTFont(_BOLD_FONT_NAME, str(_font_path("Samim-Bold.ttf")))
        )


def _plain_text(value: object | None) -> str:
    if value is None:
        return ""
    text = _BREAK_PATTERN.sub("\n", str(value))
    text = _PARAGRAPH_PATTERN.sub("\n", text)
    return unescape(_TAG_PATTERN.sub("", text)).replace("\r", "").strip()


def _rtl(value: object | None) -> str:
    text = _plain_text(value)
    if not text:
        return ""
    return "<br/>".join(
        escape(get_display(arabic_reshaper.reshape(line))) if line else "&nbsp;"
        for line in text.split("\n")
    )


def _price(value: object | None, currency: object | None) -> str:
    if value is None:
        return "-"
    try:
        rendered = f"{value:,.0f}"
    except (TypeError, ValueError):
        rendered = str(value)
    return f"{rendered} {currency or ''}".strip()


def _time(value: object | None) -> str:
    return str(value)[:5] if value else "-"


def _generated_at_jalali() -> str:
    """Return the PDF generation date in Tehran's local Jalali calendar."""
    return _gregorian_to_jalali(datetime.now(_TEHRAN_TIMEZONE).date())


def _right_to_left_table(
    headers: list[str],
    rows: list[list[object | None]],
    widths: list[float],
) -> tuple[list[str], list[list[object | None]], list[float]]:
    """Put the first logical column at the visual right edge of the table."""
    return (
        list(reversed(headers)),
        [list(reversed(row)) for row in rows],
        list(reversed(widths)),
    )


async def create_tour_package_pdf(
    session: AsyncSession, tour: Tour, *, include_internal_note: bool
) -> bytes:
    """Render the operational tour package in a worker thread.

    The session argument remains for route compatibility. Images are intentionally
    excluded from this compact package.
    """
    del session
    return await to_thread.run_sync(
        render_tour_package_pdf, tour, include_internal_note
    )


def combined_pdf_variants(tour: Tour) -> list[SimpleNamespace]:
    """Project dated prices into PDF rows without mutating the saved packages."""
    departures = {item.id: item for item in tour.departures}
    variants = []
    fields = (
        "double",
        "single",
        "child_with_bed",
        "child_without_bed",
        "infant",
        "regular_flight",
        "child_without_bed_flight",
    )
    for package in tour.combined_packages:
        base = {
            f"{field}_{suffix}": getattr(package, f"{field}_{suffix}")
            for field in fields
            for suffix in ("price", "currency")
        }
        base.update(
            {
                f"add_flight_to_{field}": getattr(package, f"add_flight_to_{field}")
                for field in fields[:5]
            }
        )
        base.update(title=package.title, hotels=package.hotels)
        for occupancy in ("double", "single"):
            base[f"{occupancy}_flight_price"] = getattr(
                package, f"{occupancy}_flight_price", None
            )
        if not package.departure_prices:
            base["add_flight_to_child_with_bed"] = False
            base["add_flight_to_infant"] = False
            base["add_flight_to_child_without_bed"] = bool(
                package.add_flight_to_child_without_bed
                and package.child_without_bed_flight_price
            )
            variants.append(
                SimpleNamespace(
                    **base,
                    child_with_bed_flight_price=None,
                    child_with_bed_flight_currency="IRT",
                )
            )
            continue
        for rate in package.departure_prices:
            departure = departures.get(rate.departure_id)
            if departure is None:
                continue
            values = dict(base)
            for occupancy in ("double", "single"):
                values[f"{occupancy}_flight_price"] = getattr(
                    rate, f"{occupancy}_flight_price", None
                )
            for field in (*fields[:6], "child_with_bed_flight"):
                for suffix in ("price", "currency"):
                    values[f"{field}_{suffix}"] = getattr(rate, f"{field}_{suffix}")
            values.update(
                title=f"{package.title} · {_gregorian_to_jalali(departure.departure_date) if departure.departure_date else departure.label}",
                add_flight_to_double=True,
                add_flight_to_single=True,
                add_flight_to_child_with_bed=bool(
                    rate.child_with_bed_flight_price
                    and (rate.child_with_bed_flight_currency or "IRT").strip().upper()
                    not in {"IRT", "IRR", "RIAL", "TOMAN", "TMN"}
                ),
                add_flight_to_child_without_bed=False,
                add_flight_to_infant=False,
                child_without_bed_flight_price=None,
            )
            variants.append(SimpleNamespace(**values))
    return variants


def render_tour_package_pdf(tour: Tour, include_internal_note: bool) -> bytes:
    """Render schedule, flight, hotel, and pricing data into an A4 PDF."""
    _register_fonts()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.35 * cm,
        leftMargin=1.35 * cm,
        topMargin=2.15 * cm,
        bottomMargin=1.45 * cm,
        title=f"پکیج تور {tour.title}",
        author="جهان باستان",
    )
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "TourPackageBody",
        parent=base["BodyText"],
        fontName=_FONT_NAME,
        fontSize=9.25,
        leading=15,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#19355D"),
    )
    title = ParagraphStyle(
        "TourPackageTitle",
        parent=body,
        fontName=_BOLD_FONT_NAME,
        fontSize=21,
        leading=29,
        textColor=_NAVY,
    )
    heading = ParagraphStyle(
        "TourPackageHeading",
        parent=body,
        fontName=_BOLD_FONT_NAME,
        fontSize=13.5,
        leading=22,
        spaceBefore=14,
        spaceAfter=6,
        textColor=_NAVY,
    )
    table_header = ParagraphStyle(
        "TourPackageTableHeader",
        parent=body,
        fontName=_BOLD_FONT_NAME,
        fontSize=8.75,
        leading=13,
        textColor=colors.white,
    )
    table_cell = ParagraphStyle(
        "TourPackageTableCell",
        parent=body,
        fontSize=8.4,
        leading=13.5,
    )
    muted = ParagraphStyle(
        "TourPackageMuted",
        parent=body,
        fontSize=8.5,
        leading=14,
        textColor=_MUTED,
    )
    story: list[object] = []

    def paragraph(value: object | None, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(_rtl(value) or "-", style)

    def add_table(
        section_title: str,
        headers: list[str],
        rows: list[list[object | None]],
        widths: list[float],
    ) -> None:
        if not rows:
            return
        story.append(paragraph(section_title, heading))
        headers, rows, widths = _right_to_left_table(headers, rows, widths)
        data = [[paragraph(header, table_header) for header in headers]]
        data.extend(
            [
                paragraph(value if value not in (None, "") else "-", table_cell)
                for value in row
            ]
            for row in rows
        )
        rendered = Table(data, colWidths=widths, repeatRows=1, hAlign="RIGHT")
        rendered.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), _NAVY),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_LIGHT_BLUE, colors.white]),
                    ("BOX", (0, 0), (-1, -1), 0.7, _BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.35, _BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(rendered)

    story.append(paragraph("جهان باستان | پکیج سفر", muted))
    story.append(paragraph(tour.title, title))
    story.append(Spacer(1, 0.18 * cm))

    add_table(
        "مشخصات تور",
        ["عنوان", "مقدار"],
        [
            ["نوع تور", tour.tour_type],
            ["مقصد", getattr(tour.destination, "title", None)],
            ["مبدا", tour.origin],
            ["مدت", f"{tour.duration_days} روز" if tour.duration_days else None],
            ["مدت اقامت", f"{tour.stay_nights} شب" if tour.stay_nights else None],
            ["تاریخ حرکت", tour.departure_date],
            ["قیمت پایه", _price(tour.price_amount, tour.currency)],
            ["حمل و نقل", tour.transportation],
            ["پرواز در پکیج", "بله" if tour.flight_included else "خیر"],
            ["ترانسفر فرودگاهی", "بله" if tour.airport_transfer_included else "خیر"],
            [
                "هزینه جداگانه پرواز",
                _price(tour.flight_price_amount, tour.flight_price_currency)
                if tour.flight_price_amount is not None
                else None,
            ],
        ],
        [5.1 * cm, 11.1 * cm],
    )

    flight_rows: list[list[object | None]] = []
    if any(
        [
            tour.airline_name,
            tour.flight_number,
            tour.origin_airport,
            tour.destination_airport,
            tour.departure_time,
        ]
    ):
        flight_rows.append(
            [
                "پرواز رفت",
                tour.airline_name,
                tour.flight_number,
                f"{tour.origin_airport or '-'} ← {tour.destination_airport or '-'}",
                _time(tour.departure_time),
                _time(getattr(tour, "arrival_time", None)),
            ]
        )
    if any(
        [
            tour.return_airline_name,
            tour.return_flight_number,
            tour.return_origin_airport,
            tour.return_destination_airport,
            tour.return_departure_time,
        ]
    ):
        flight_rows.append(
            [
                "پرواز برگشت",
                tour.return_airline_name,
                tour.return_flight_number,
                f"{tour.return_origin_airport or '-'} ← {tour.return_destination_airport or '-'}",
                _time(tour.return_departure_time),
                _time(tour.return_arrival_time),
            ]
        )
    add_table(
        "اطلاعات پرواز",
        ["مسیر", "ایرلاین", "شماره", "فرودگاه ها", "حرکت", "رسیدن"],
        flight_rows,
        [2.25 * cm, 2.55 * cm, 2.1 * cm, 4.7 * cm, 2.25 * cm, 2.25 * cm],
    )

    if tour.departures:
        add_table(
            "تاریخ ها و قیمت های قابل انتخاب",
            ["عنوان", "تاریخ رفت / برگشت", "ظرفیت", "وضعیت", "قیمت هر نفر"],
            [
                [
                    f"{departure.label} | {departure.external_code or '-'}",
                    f"{departure.departure_date or '-'} / {departure.return_date or '-'}",
                    f"{departure.capacity_remaining if departure.capacity_remaining is not None else '-'} از {departure.capacity_total if departure.capacity_total is not None else '-'}",
                    departure.booking_status,
                    _price(departure.price_amount, departure.currency),
                ]
                for departure in tour.departures
            ],
            [4.1 * cm, 4.0 * cm, 3.0 * cm, 2.7 * cm, 3.9 * cm],
        )
        add_table(
            "پروازهای هر نوبت",
            ["نوبت", "رفت", "ساعت رفت", "برگشت", "ساعت برگشت"],
            [
                [
                    departure.label,
                    departure.outbound_flight_number,
                    f"{_time(departure.outbound_departure_time)} تا {_time(departure.outbound_arrival_time)}",
                    departure.return_flight_number,
                    f"{_time(departure.return_departure_time)} تا {_time(departure.return_arrival_time)}",
                ]
                for departure in tour.departures
                if departure.outbound_flight_number or departure.return_flight_number
            ],
            [3.6 * cm, 3.3 * cm, 4.0 * cm, 3.3 * cm, 4.0 * cm],
        )
        departure_hotel_rows: list[list[object | None]] = []
        for departure in tour.departures:
            for offer in departure.hotel_prices:
                departure_hotel_rows.append(
                    [
                        f"{departure.label} | {offer.hotel.name}",
                        f"{offer.room_type or '-'} | {offer.service_type or '-'}",
                        _price(
                            offer.double_price,
                            getattr(offer, "double_currency", None)
                            or offer.package_currency,
                        ),
                        _price(
                            offer.single_price,
                            getattr(offer, "single_currency", None)
                            or offer.package_currency,
                        ),
                        _price(
                            offer.child_with_bed_price,
                            getattr(offer, "child_with_bed_currency", None)
                            or offer.package_currency,
                        ),
                        _price(
                            offer.child_without_bed_price,
                            offer.child_without_bed_currency,
                        ),
                    ]
                )
        add_table(
            "اقامت و قیمت هتل در تاریخ های تور",
            [
                "تاریخ و هتل",
                "اتاق / خدمات",
                "دو تخته",
                "یک تخته",
                "کودک با تخت",
                "کودک بی تخت",
            ],
            departure_hotel_rows,
            [3.25 * cm, 2.8 * cm, 2.55 * cm, 2.55 * cm, 2.55 * cm, 2.55 * cm],
        )

    combined_packages = combined_pdf_variants(tour)
    if combined_packages:
        add_table(
            "پکیج های اقامت ترکیبی",
            ["عنوان", "هتل ها", "دو تخته", "یک تخته", "کودک با تخت", "کودک بی تخت"],
            [
                [
                    package.title,
                    " + ".join(
                        f"{assignment.hotel.name} ({assignment.nights} شب"
                        f"{f'، {assignment.board_type}' if assignment.board_type else ''})"
                        for assignment in package.hotels
                    ),
                    _price(package.double_price, package.double_currency),
                    _price(package.single_price, package.single_currency),
                    _price(
                        package.child_with_bed_price,
                        package.child_with_bed_currency,
                    ),
                    _price(
                        package.child_without_bed_price,
                        package.child_without_bed_currency,
                    ),
                ]
                for package in combined_packages
            ],
            [3.2 * cm, 4.4 * cm, 2.65 * cm, 2.65 * cm, 2.65 * cm, 2.65 * cm],
        )
        add_table(
            "هزینه پرواز پکیج های ترکیبی",
            ["عنوان", "پرواز عادی", "پرواز کودک با تخت / بی تخت", "اعمال پرواز برای"],
            [
                [
                    package.title,
                    "دو تخته: "
                    + _price(
                        package.double_flight_price
                        if package.double_flight_price is not None
                        else package.regular_flight_price,
                        package.regular_flight_currency,
                    )
                    + " / یک تخته: "
                    + _price(
                        package.single_flight_price
                        if package.single_flight_price is not None
                        else package.regular_flight_price,
                        package.regular_flight_currency,
                    ),
                    "با تخت: "
                    + _price(
                        package.child_with_bed_flight_price,
                        package.child_with_bed_flight_currency,
                    )
                    + " / بی تخت: "
                    + _price(
                        None
                        if not package.add_flight_to_child_without_bed
                        else (
                            package.child_without_bed_flight_price
                            if package.child_without_bed_flight_price is not None
                            else package.regular_flight_price
                        ),
                        (
                            package.child_without_bed_flight_currency
                            if package.child_without_bed_flight_price is not None
                            else package.regular_flight_currency
                        ),
                    ),
                    "، ".join(
                        label
                        for enabled, label in (
                            (
                                package.add_flight_to_double and package.double_price,
                                "دو تخته",
                            ),
                            (
                                package.add_flight_to_single and package.single_price,
                                "یک تخته",
                            ),
                            (
                                package.add_flight_to_child_with_bed
                                and package.child_with_bed_price,
                                "کودک با تخت",
                            ),
                            (
                                package.add_flight_to_child_without_bed
                                and package.child_without_bed_price,
                                "کودک بی تخت",
                            ),
                            (
                                package.add_flight_to_infant and package.infant_price,
                                "نوزاد",
                            ),
                        )
                        if enabled
                    ),
                ]
                for package in combined_packages
            ],
            [4.0 * cm, 3.6 * cm, 4.2 * cm, 6.3 * cm],
        )

    if tour.hotel_packages:
        add_table(
            "پکیج های اقامت",
            ["هتل", "اقامت", "دو تخته", "یک تخته", "کودک با تخت", "کودک بی تخت"],
            [
                [
                    f"{package.hotel.name} | {package.hotel.star_rating or '-'} ستاره",
                    " | ".join(
                        part
                        for part in [
                            f"{package.nights} شب" if package.nights else None,
                            package.board_type,
                        ]
                        if part
                    ),
                    _price(package.double_price, package.currency),
                    _price(package.single_price, package.currency),
                    _price(package.child_with_bed_price, package.currency),
                    _price(package.child_without_bed_price, package.currency),
                ]
                for package in tour.hotel_packages
            ],
            [3.7 * cm, 2.0 * cm, 2.65 * cm, 2.65 * cm, 2.65 * cm, 2.65 * cm],
        )
    elif tour.hotel:
        add_table(
            "هتل تور",
            ["هتل", "درجه", "آدرس"],
            [
                [
                    tour.hotel.name,
                    f"{tour.hotel.star_rating or '-'} ستاره",
                    tour.hotel.address,
                ]
            ],
            [4.8 * cm, 2.8 * cm, 10.7 * cm],
        )

    if tour.itinerary_days:
        add_table(
            "برنامه روزانه سفر",
            ["روز", "عنوان", "شرح برنامه"],
            [
                [f"روز {item.day_number}", item.title, item.description]
                for item in tour.itinerary_days
            ],
            [1.5 * cm, 4.0 * cm, 12.8 * cm],
        )
    elif tour.itinerary:
        add_table("برنامه سفر", ["شرح برنامه"], [[tour.itinerary]], [18.3 * cm])

    if tour.travel_legs:
        add_table(
            "مسیرهای سفر",
            ["وسیله", "تاریخ", "مبدا", "مقصد", "حرکت", "رسیدن"],
            [
                [
                    " | ".join(
                        part
                        for part in [
                            item.title,
                            normalize_tour_stage_type(item.stage_type),
                            item.transportation,
                            item.travel_class,
                            f"{item.duration_minutes} دقیقه"
                            if item.duration_minutes
                            else None,
                            f"{item.baggage_allowance_kg} کیلو بار"
                            if item.baggage_allowance_kg
                            else None,
                        ]
                        if part
                    ),
                    item.departure_date,
                    f"{item.origin or '-'} {item.origin_terminal or ''}".strip(),
                    f"{item.destination or '-'} {item.destination_terminal or ''}".strip(),
                    _time(item.departure_time),
                    _time(item.arrival_time),
                ]
                for item in tour.travel_legs
            ],
            [2.4 * cm, 2.6 * cm, 3.5 * cm, 3.5 * cm, 3.15 * cm, 3.15 * cm],
        )

    for section_title, column_title, value in [
        ("مدارک لازم", "مدرک", tour.required_documents),
        ("خدمات تور", "خدمات", tour.included_services),
        ("شرایط اقساط", "شرایط", tour.installment_terms),
        ("قوانین لغو و استرداد", "قوانین", tour.refund_policy),
        ("توضیحات تکمیلی", "توضیحات", tour.tour_notes),
    ]:
        if value:
            add_table(section_title, [column_title], [[value]], [18.3 * cm])
    if include_internal_note and tour.internal_note:
        add_table(
            "یادداشت داخلی مدیران", ["یادداشت"], [[tour.internal_note]], [18.3 * cm]
        )

    generated_at = _generated_at_jalali()

    def page_frame(canvas: object, doc: object) -> None:
        canvas.saveState()  # type: ignore[attr-defined]
        canvas.setFont(_BOLD_FONT_NAME, 9)  # type: ignore[attr-defined]
        canvas.setFillColor(_NAVY)  # type: ignore[attr-defined]
        canvas.drawRightString(
            19.5 * cm, 28.75 * cm, _rtl(f"تاریخ تهیه خروجی: {generated_at}")
        )  # type: ignore[attr-defined]
        canvas.setStrokeColor(_BORDER)  # type: ignore[attr-defined]
        canvas.setLineWidth(0.5)  # type: ignore[attr-defined]
        canvas.line(1.35 * cm, 28.42 * cm, 19.65 * cm, 28.42 * cm)  # type: ignore[attr-defined]
        canvas.setFont(_FONT_NAME, 8)  # type: ignore[attr-defined]
        canvas.setFillColor(_MUTED)  # type: ignore[attr-defined]
        canvas.drawRightString(19.5 * cm, 0.82 * cm, _rtl("جهان باستان | پکیج تور"))  # type: ignore[attr-defined]
        canvas.drawString(1.35 * cm, 0.82 * cm, str(doc.page))  # type: ignore[attr-defined]
        canvas.restoreState()  # type: ignore[attr-defined]

    document.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    return buffer.getvalue()
