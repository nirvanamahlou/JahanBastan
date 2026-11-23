"""Generate Persian booking proforma and invoice PDF documents."""

from io import BytesIO

from anyio import to_thread
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import BookingRequest
from app.services.tour_pdf import _BOLD_FONT_NAME, _FONT_NAME, _register_fonts, _rtl


async def create_booking_proforma_pdf(
    booking: BookingRequest, *, display_total=None, display_currency: str | None = None
) -> bytes:
    """Render a proforma for a booking that is awaiting review."""
    return await to_thread.run_sync(
        render_booking_proforma_pdf, booking, display_total, display_currency
    )


async def create_booking_invoice_pdf(
    booking: BookingRequest, *, display_total=None, display_currency: str | None = None
) -> bytes:
    """Render an invoice for an approved or paid booking."""
    return await to_thread.run_sync(
        render_booking_invoice_pdf, booking, display_total, display_currency
    )


def render_booking_proforma_pdf(
    booking: BookingRequest, display_total=None, display_currency: str | None = None
) -> bytes:
    """Render a pending booking as a proforma PDF."""
    return _render_booking_document(
        booking,
        is_invoice=False,
        display_total=display_total,
        display_currency=display_currency,
    )


def render_booking_invoice_pdf(
    booking: BookingRequest, display_total=None, display_currency: str | None = None
) -> bytes:
    """Render an approved booking as an invoice PDF."""
    return _render_booking_document(
        booking,
        is_invoice=True,
        display_total=display_total,
        display_currency=display_currency,
    )


def _render_booking_document(
    booking: BookingRequest,
    *,
    is_invoice: bool,
    display_total=None,
    display_currency: str | None = None,
) -> bytes:
    _register_fonts()
    shown_total = booking.total_amount if display_total is None else display_total
    shown_currency = display_currency or booking.currency
    buffer = BytesIO()
    document_name = "فاکتور" if is_invoice else "پیش‌فاکتور"
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title=f"{document_name} {booking.booking_number}",
        author="جهان باستان",
    )
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "BookingBody",
        parent=base["BodyText"],
        fontName=_FONT_NAME,
        fontSize=9.5,
        leading=16,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#19355D"),
    )
    bold = ParagraphStyle("BookingBold", parent=body, fontName=_BOLD_FONT_NAME)
    title = ParagraphStyle(
        "BookingTitle",
        parent=bold,
        fontSize=20,
        leading=28,
        textColor=colors.HexColor("#073B82"),
    )

    def currency_label(code: str | None) -> str:
        return "تومان" if (code or "").upper() == "IRT" else (code or "")

    def paragraph(value: object, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(_rtl(str(value)) or "-", style)

    status_labels = {
        "pending_review": "در انتظار تأیید",
        "approved": "پرداخت تأیید شد",
        "rejected": "رد شده",
        "paid": "پرداخت شده",
    }
    story = [
        paragraph(f"جهان باستان | {document_name} رزرو", title),
        Spacer(1, 0.25 * cm),
    ]
    meta = Table(
        [
            [
                paragraph(booking.booking_number, bold),
                paragraph(f"شماره {document_name}", bold),
            ],
            [paragraph(booking.customer.full_name), paragraph("مسافر")],
            [paragraph(booking.customer.email), paragraph("ایمیل")],
            [paragraph(str(booking.created_at)[:16]), paragraph("تاریخ ثبت")],
            [
                paragraph(status_labels.get(booking.status, booking.status)),
                paragraph("وضعیت"),
            ],
        ],
        colWidths=[10.5 * cm, 5.5 * cm],
        hAlign="RIGHT",
    )
    common = [
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#C9D9F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C9D9F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]
    meta.setStyle(
        TableStyle(
            common
            + [
                (
                    "ROWBACKGROUNDS",
                    (0, 0),
                    (-1, -1),
                    [colors.white, colors.HexColor("#F7FAFF")],
                )
            ]
        )
    )
    story += [meta, Spacer(1, 0.45 * cm), paragraph("جزئیات درخواست", title)]
    data = [
        [
            paragraph("مبلغ", bold),
            paragraph("شرح", bold),
            paragraph("عنوان", bold),
            paragraph("ردیف", bold),
        ]
    ]
    for index, item in enumerate(booking.items, 1):
        data.append(
            [
                paragraph(
                    f"{item.price_amount:,.0f} {item.currency}"
                    if item.price_amount is not None and item.currency
                    else "در انتظار اعلام مبلغ"
                ),
                paragraph(item.details_snapshot or "-"),
                paragraph(item.title_snapshot, bold),
                paragraph(index),
            ]
        )
    data.append(
        [
            paragraph(
                f"{shown_total:,.0f} {currency_label(shown_currency)}"
                if shown_total is not None
                else "در انتظار تأیید پشتیبان",
                bold,
            ),
            paragraph(""),
            paragraph("جمع کل", bold),
            paragraph(""),
        ]
    )
    lines = Table(
        data,
        colWidths=[3.7 * cm, 6.2 * cm, 4.8 * cm, 1.3 * cm],
        repeatRows=1,
        hAlign="RIGHT",
    )
    lines.setStyle(
        TableStyle(
            common
            + [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073B82")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -2),
                    [colors.HexColor("#F7FAFF"), colors.white],
                ),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E8F1FF")),
            ]
        )
    )
    story += [lines, Spacer(1, 0.4 * cm)]
    if shown_total is not None and (shown_currency or "").upper() == "IRT":
        story.append(
            paragraph(
                "جمع کل این فاکتور با نرخ‌های ثبت‌شده مدیریت به تومان محاسبه شده است."
            )
        )
    if is_invoice:
        story.append(
            paragraph(
                "این فاکتور پس از تأیید درخواست صادر شده است. برای تکمیل پرداخت، "
                "از گزینه پرداخت در درگاه در پنل مسافر استفاده کنید."
            )
        )
    else:
        story.append(
            paragraph(
                "این سند پیش‌فاکتور است و رسید پرداخت محسوب نمی‌شود. پرداخت فقط "
                "پس از تأیید مدیریت فعال خواهد شد."
            )
        )
    if booking.customer_note:
        story += [
            Spacer(1, 0.2 * cm),
            paragraph(f"یادداشت مسافر: {booking.customer_note}"),
        ]
    if booking.admin_note:
        story += [
            Spacer(1, 0.2 * cm),
            paragraph(f"پاسخ مدیریت: {booking.admin_note}"),
        ]
    doc.build(story)
    return buffer.getvalue()
