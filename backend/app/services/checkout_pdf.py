"""Persian installment schedule PDF generation."""

from io import BytesIO

from anyio import to_thread
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import BookingRequest
from app.models.checkout import BookingInstallment
from app.services.tour_pdf import _BOLD_FONT_NAME, _FONT_NAME, _register_fonts, _rtl


async def create_installment_schedule_pdf(
    booking: BookingRequest, installments: list[BookingInstallment]
) -> bytes:
    return await to_thread.run_sync(
        render_installment_schedule_pdf, booking, installments
    )


def render_installment_schedule_pdf(
    booking: BookingRequest, installments: list[BookingInstallment]
) -> bytes:
    _register_fonts()
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title=f"برنامه اقساط {booking.booking_number}",
        author="جهان باستان",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "InstallmentBody",
        parent=styles["BodyText"],
        fontName=_FONT_NAME,
        fontSize=10,
        leading=16,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#19355D"),
    )
    bold = ParagraphStyle("InstallmentBold", parent=body, fontName=_BOLD_FONT_NAME)
    title = ParagraphStyle(
        "InstallmentTitle",
        parent=bold,
        fontSize=19,
        leading=28,
        textColor=colors.HexColor("#073B82"),
    )

    def paragraph(value: object, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(_rtl(str(value)) or "-", style)

    story = [
        paragraph("جهان باستان | جدول زمان‌بندی پرداخت اقساط", title),
        Spacer(1, 0.25 * cm),
        paragraph(f"شماره سفارش: {booking.booking_number}", bold),
        paragraph(
            f"پیش‌پرداخت: {booking.installment_down_payment or 0:,.0f} "
            f"{booking.currency}"
        ),
        paragraph(
            f"مبلغ کل اقساط: {booking.installment_total_amount or 0:,.0f} "
            f"{booking.currency}"
        ),
        Spacer(1, 0.35 * cm),
    ]
    rows = [
        [
            paragraph("وضعیت", bold),
            paragraph("مبلغ پرداخت‌شده", bold),
            paragraph("مبلغ قسط", bold),
            paragraph("سررسید", bold),
            paragraph("ردیف", bold),
        ]
    ]
    status_labels = {
        "upcoming": "آینده",
        "due": "سررسید",
        "paid": "پرداخت‌شده",
        "partial": "پرداخت جزئی",
        "overdue": "معوق",
        "waived": "بخشوده",
        "rescheduled": "تمدیدشده",
    }
    for item in installments:
        rows.append(
            [
                paragraph(status_labels.get(item.status, item.status)),
                paragraph(f"{item.paid_amount:,.0f}"),
                paragraph(f"{item.amount:,.0f}", bold),
                paragraph(item.due_date.isoformat()),
                paragraph(item.sequence),
            ]
        )
    table = Table(
        rows,
        colWidths=[3.2 * cm, 3.7 * cm, 3.7 * cm, 3.3 * cm, 1.2 * cm],
        repeatRows=1,
        hAlign="RIGHT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#C9D9F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C9D9F0")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073B82")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#F7FAFF")],
                ),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story += [
        table,
        Spacer(1, 0.35 * cm),
        paragraph(
            "این جدول بخشی از پرونده خرید اقساطی است. تأیید نهایی مبالغ و "
            "ضمانت‌ها پس از بررسی کارشناس فروش انجام می‌شود."
        ),
    ]
    document.build(story)
    return output.getvalue()
