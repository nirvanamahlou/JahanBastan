"""XLSX export for one privacy-scoped customer support file."""

from collections.abc import Iterable
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

from app.schemas.admin import CustomerFileRead


def _cell_value(value: object | None) -> object:
    if value is None or value == "":
        return "—"
    if isinstance(value, (date, datetime)):
        return (
            value.isoformat(sep=" ")
            if isinstance(value, datetime)
            else value.isoformat()
        )
    return str(value)


def _append_sheet(
    workbook: Workbook,
    title: str,
    headers: list[str],
    rows: Iterable[list[object | None]],
) -> Worksheet:
    sheet = workbook.create_sheet(title)
    sheet.sheet_view.rightToLeft = True
    sheet.freeze_panes = "A2"
    sheet.append(headers)
    header_fill = PatternFill("solid", fgColor="082B68")
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="right", vertical="center")
    for row in rows:
        sheet.append([_cell_value(value) for value in row])
    for column in sheet.columns:
        letter = column[0].column_letter
        max_width = max((len(str(cell.value or "")) for cell in column), default=10)
        sheet.column_dimensions[letter].width = min(max(max_width + 3, 12), 42)
        for cell in column:
            cell.alignment = Alignment(
                horizontal="right", vertical="top", wrap_text=True
            )
    sheet.auto_filter.ref = sheet.dimensions
    return sheet


def create_customer_file_xlsx(profile: CustomerFileRead) -> bytes:
    """Create a readable multi-sheet workbook without passwords or bank details."""
    workbook = Workbook()
    summary = workbook.active
    summary.title = "خلاصه پرونده"
    summary.sheet_view.rightToLeft = True
    summary.append(["عنوان", "اطلاعات"])
    summary_rows = [
        ("شناسه پرونده", profile.id),
        ("نام و نام خانوادگی", profile.full_name),
        ("ایمیل", profile.email),
        ("شماره موبایل", profile.phone),
        ("شماره اضطراری", profile.emergency_phone),
        ("کد ملی", profile.national_code),
        ("تاریخ تولد", profile.birth_date),
        ("نشانی", profile.address),
        ("وضعیت حساب", "فعال" if profile.is_active else "غیرفعال"),
        ("زمان ثبت‌نام", profile.created_at),
        ("آخرین ورود", profile.last_login_at),
        ("اعتبار کیف پول", profile.wallet_credit),
        ("واحد کیف پول", profile.wallet_currency),
        ("تعداد درخواست پشتیبانی", profile.support_request_count),
        ("تعداد مسافران", len(profile.passengers)),
        ("تعداد رزروها", len(profile.bookings)),
        ("تعداد بلیت‌های صادرشده", len(profile.tickets)),
        ("تعداد مدارک", len(profile.documents)),
    ]
    for row in summary_rows:
        summary.append([_cell_value(value) for value in row])
    for cell in summary[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="082B68")
        cell.alignment = Alignment(horizontal="right")
    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 54
    for row in summary.iter_rows():
        for cell in row:
            cell.alignment = Alignment(
                horizontal="right", vertical="top", wrap_text=True
            )

    _append_sheet(
        workbook,
        "مسافران",
        [
            "شناسه",
            "نام کامل",
            "نام لاتین",
            "نام پدر",
            "کد ملی",
            "پاسپورت",
            "انقضای پاسپورت",
            "تاریخ تولد",
            "جنسیت",
            "موبایل",
            "ایمیل",
            "مسافر پیش‌فرض",
        ],
        [
            [
                item.id,
                item.full_name,
                " ".join(
                    part for part in (item.first_name_en, item.last_name_en) if part
                ),
                item.father_name,
                item.national_code,
                item.passport_number,
                item.passport_expiry_date,
                item.birth_date,
                item.gender,
                item.phone,
                item.email,
                "بله" if item.is_default else "خیر",
            ]
            for item in profile.passengers
        ],
    )
    _append_sheet(
        workbook,
        "رزروها",
        [
            "شماره سفارش",
            "وضعیت",
            "خدمات",
            "مبلغ",
            "واحد",
            "روش پرداخت",
            "تعداد مسافر",
            "تعداد بلیت",
            "تعداد مدرک",
            "مهلت پرداخت",
            "تاریخ ثبت",
        ],
        [
            [
                item.booking_number,
                item.status,
                " | ".join(item.service_titles),
                item.total_amount,
                item.currency,
                item.payment_method,
                item.passenger_count,
                item.ticket_count,
                item.document_count,
                item.payment_expires_at,
                item.created_at,
            ]
            for item in profile.bookings
        ],
    )
    _append_sheet(
        workbook,
        "بلیت‌ها",
        [
            "شماره بلیت",
            "مسافر",
            "نوع مسافر",
            "نوع خدمت",
            "عنوان خدمت",
            "مسیر",
            "فرودگاه مبدا",
            "فرودگاه مقصد",
            "تاریخ حرکت",
            "ساعت",
            "شرکت حمل‌ونقل",
            "کلاس",
            "بار مجاز",
            "زمان صدور",
        ],
        [
            [
                item.ticket_number,
                item.passenger_name,
                item.passenger_type,
                item.item_type,
                item.service_title,
                item.route,
                item.departure_airport,
                item.arrival_airport,
                item.departure_date,
                item.departure_time,
                item.carrier,
                item.travel_class,
                item.baggage_allowance,
                item.issued_at,
            ]
            for item in profile.tickets
        ],
    )
    _append_sheet(
        workbook,
        "مدارک",
        [
            "شماره سفارش",
            "مسافر",
            "نام فایل",
            "نوع فایل",
            "حجم (بایت)",
            "وضعیت",
            "یادداشت بررسی",
            "زمان بارگذاری",
        ],
        [
            [
                item.booking_number,
                item.passenger_name,
                item.original_name,
                item.mime_type,
                item.byte_size,
                item.status,
                item.review_note,
                item.created_at,
            ]
            for item in profile.documents
        ],
    )
    _append_sheet(
        workbook,
        "پرداخت‌ها",
        [
            "شماره قرارداد",
            "مبلغ",
            "واحد",
            "وضعیت",
            "درگاه",
            "شناسه پیگیری",
            "زمان تأیید",
            "زمان ایجاد",
        ],
        [
            [
                item.crm_contract_number,
                item.amount,
                item.currency,
                item.status,
                item.provider,
                item.provider_reference,
                item.verified_at,
                item.created_at,
            ]
            for item in profile.payments
        ],
    )
    _append_sheet(
        workbook,
        "درخواست ویزا",
        ["شناسه درخواست", "خدمت", "وضعیت", "تعداد مدرک", "زمان ایجاد", "آخرین تغییر"],
        [
            [
                item.id,
                item.service_title,
                item.status,
                item.document_count,
                item.created_at,
                item.updated_at,
            ]
            for item in profile.visa_applications
        ],
    )
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
