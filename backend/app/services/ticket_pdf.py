"""Persian PDF tickets that are safe to view, print, or save by customers."""

from io import BytesIO

from anyio import to_thread
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import BookingPassengerTicket, BookingRequest
from app.services.tour_pdf import _BOLD_FONT_NAME, _FONT_NAME, _register_fonts, _rtl


async def create_booking_ticket_pdf(
    booking: BookingRequest, ticket: BookingPassengerTicket
) -> bytes:
    return await to_thread.run_sync(render_booking_ticket_pdf, booking, ticket)


def render_booking_ticket_pdf(
    booking: BookingRequest, ticket: BookingPassengerTicket
) -> bytes:
    _register_fonts()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title=f"بلیت {ticket.ticket_number}",
        author="جهان باستان",
    )
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "TicketBody",
        parent=base["BodyText"],
        fontName=_FONT_NAME,
        fontSize=9.5,
        leading=16,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#19355D"),
    )
    bold = ParagraphStyle("TicketBold", parent=body, fontName=_BOLD_FONT_NAME)
    title = ParagraphStyle(
        "TicketTitle",
        parent=bold,
        fontSize=20,
        leading=28,
        textColor=colors.HexColor("#073B82"),
    )

    def value(raw: object) -> Paragraph:
        return Paragraph(_rtl(str(raw)) if raw not in (None, "") else "—", body)

    def label(raw: str) -> Paragraph:
        return Paragraph(_rtl(raw), bold)

    full_name_en = " ".join(
        part for part in [ticket.first_name_en, ticket.last_name_en] if part
    )
    departure_date = (
        ticket.departure_date.isoformat() if ticket.departure_date else None
    )
    departure_time = (
        ticket.departure_time.strftime("%H:%M") if ticket.departure_time else None
    )
    rows = [
        [value(ticket.ticket_number), label("شماره بلیت")],
        [value(booking.booking_number), label("شماره سفارش")],
        [value(f"{ticket.first_name} {ticket.last_name}"), label("نام فارسی")],
        [value(full_name_en), label("نام لاتین")],
        [value(ticket.father_name), label("نام پدر")],
        [value(ticket.national_code), label("کد ملی")],
        [value(ticket.passport_number), label("شماره گذرنامه")],
        [value(ticket.service_title), label("خدمت")],
        [value(ticket.route), label("مسیر")],
        [value(ticket.departure_airport), label("فرودگاه مبدأ")],
        [value(ticket.arrival_airport), label("فرودگاه مقصد")],
        [
            value(departure_date),
            label("تاریخ حرکت"),
        ],
        [
            value(departure_time),
            label("ساعت حرکت"),
        ],
        [value(ticket.carrier), label("شرکت حمل‌ونقل")],
        [value(ticket.travel_class), label("کلاس سفر")],
        [value(ticket.baggage_allowance), label("بار مجاز")],
    ]
    table = Table(rows, colWidths=[11.2 * cm, 4.8 * cm], hAlign="RIGHT")
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#C9D9F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C9D9F0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 7),
                ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#E8F1FF")),
                (
                    "ROWBACKGROUNDS",
                    (0, 0),
                    (0, -1),
                    [colors.white, colors.HexColor("#F7FAFF")],
                ),
            ]
        )
    )
    story = [
        Paragraph(_rtl("جهان باستان | بلیت مسافر"), title),
        Spacer(1, 0.25 * cm),
        table,
        Spacer(1, 0.4 * cm),
        Paragraph(
            _rtl(
                "این بلیت پس از تأیید پرداخت صادر شده است. برای ورود به وسیلهٔ "
                "نقلیه، مدرک هویتی معتبر همراه داشته باشید."
            ),
            body,
        ),
    ]
    document.build(story)
    return buffer.getvalue()
