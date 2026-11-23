"""Generate an import template from a tour's saved hotel combinations."""

from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.combined_excel import load_combined_import_context
from app.services.excel_pricing import MAX_ROWS, WorkbookValidationError


async def combined_template_rows(
    session: AsyncSession, tour_id: int
) -> list[list[Any]]:
    _, packages, _ = await load_combined_import_context(session, tour_id, lock=False)
    if sum(len(package.hotels) for package in packages) > MAX_ROWS:
        raise WorkbookValidationError(
            [
                {
                    "row": 1,
                    "message": ("تعداد هتل‌های ترکیب‌ها بیشتر از ظرفیت یک فایل است."),
                }
            ]
        )
    return [
        [
            [
                item.hotel.hotel_code,
                None,
                item.hotel.name,
                None,
                None,
                item.board_type,
                item.nights,
            ]
            for item in package.hotels
        ]
        for package in packages
        if len(package.hotels) >= 2
    ] or [[[None, None, None, None, None, "BB", None] for _ in range(2)]]


def build_combined_template(
    groups: list[list[Any]], *, include_nights: bool = False
) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "قیمت ترکیبی"
    sheet.sheet_view.rightToLeft = True
    sheet.append(
        [
            "hotel_id",
            "departure_date",
            "hotel_name",
            "loc",
            "room",
            "service",
            "DBL",
            "SGL",
            "CHD W BED",
            "child no bed",
            "infant",
            "flight per person",
            "flight child w bed",
            "EXTRA",
        ]
        + (["nights"] if include_nights else [])
    )
    for group in groups:
        first = sheet.max_row + 1
        for row in group:
            sheet.append(
                [row[0], row[1], row[2], row[3], row[4], row[5]]
                + [None] * 8
                + ([row[6] if len(row) > 6 else None] if include_nights else [])
            )
        for column in range(7, 15):
            sheet.merge_cells(
                start_row=first,
                end_row=sheet.max_row,
                start_column=column,
                end_column=column,
            )
            sheet.cell(first, column).number_format = "#,##0.00"
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="082B63")
    for column in "ABCDEFGHIJKLMN":
        sheet.column_dimensions[column].width = 42 if column == "C" else 24
    sheet.freeze_panes = "B2"
    guide = workbook.create_sheet("راهنما")
    guide.sheet_view.rightToLeft = True
    for row in (
        (
            "ساخت خودکار",
            "هر ترکیب دو ردیف متوالی دارد. نام هتل از فایل و تعداد "
            "شب از الگوی یکسان اقامت‌های همان تور خوانده می‌شود. "
            "ترکیب جدید در "
            "پیش‌نمایش ساخته و فقط با ثبت نهایی ذخیره می‌شود. برای "
            "بیش از دو هتل، قیمت‌های کل ترکیب را روی ردیف‌های آن "
            "ادغام کنید.",
        ),
        (
            "ارز",
            "ارز را در سلول بنویسید؛ مثلاً $550 یا €550. قیمت بدون "
            "علامت طبق ارز انتخاب‌شده در فرم خوانده می‌شود.",
        ),
        (
            "تاریخ",
            ("تاریخ شمسی ۱۴۰۵/۰۶/۱۸ یا میلادی 2026-09-09 را برای هر ترکیب وارد کنید."),
        ),
        (
            "قیمت",
            ("قیمت هر نفر برای کل ترکیب است؛ فقط یک‌بار در سلول ادغام‌شده وارد شود."),
        ),
        (
            "ارز",
            (
                "عدد بدون نماد تومان است. ارز هر سلول مستقل است: $ / "
                "USD، € / EUR، ₺ / TRY."
            ),
        ),
        (
            "خالی",
            (
                "خانه خالی، null، none، N/A و خط تیره، گزینه بدون قیمت "
                "هستند؛ صفر نیز قیمت قابل فروش نیست."
            ),
        ),
        (
            "پرواز",
            (
                "پرواز هر نفر برای دوتخته و تک‌تخته است. پرواز کودک با "
                "تخت از ستون خودش خوانده می‌شود؛ اگر خالی باشد نرخ پرواز بزرگسال "
                "استفاده می‌شود. صفر صریح یعنی بدون هزینه اضافه."
            ),
        ),
        ("کودک بدون تخت و نوزاد", "قیمت نهایی است و پرواز جداگانه اضافه نمی‌شود."),
        (
            "نوزاد با دو ارز",
            "مثلاً 29000000+290$ یعنی ۲۹ میلیون تومان به‌علاوه ۲۹۰ دلار؛ "
            "هر دو جزء جدا ذخیره می‌شوند.",
        ),
        (
            "تخت اضافه",
            (
                "اگر خالی باشد نمایش داده نمی‌شود؛ برای نرخ ارزی، پرواز "
                "بزرگسال به آن افزوده می‌شود."
            ),
        ),
        (
            "اقامت",
            (
                "نام هتل کلید اتصال است؛ فاصله‌های اضافه و بزرگی یا کوچکی "
                "حروف در تطبیق نادیده گرفته می‌شود. ترتیب، خدمات و تعداد شب "
                "از تعریف ترکیب در سایت حفظ می‌شود."
            ),
        ),
        (
            "ستون‌های فارسی",
            (
                "نام هتل، تاریخ حرکت، منطقه، نوع اتاق، خدمات، "
                "دوتخته، تک‌تخته، کودک با تخت، کودک بدون تخت، نوزاد، "
                "هزینه پرواز هر نفر، هزینه پرواز کودک با تخت، تخت اضافه"
            ),
        ),
    ):
        guide.append(row)
    guide.column_dimensions["A"].width = 25
    guide.column_dimensions["B"].width = 130
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()
