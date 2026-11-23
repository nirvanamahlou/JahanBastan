# ruff: noqa: B008, E501
"""Excel import and export endpoints for admin-managed CMS content."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime
from io import BytesIO
from typing import Any, Literal

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.api.dependencies.auth import AdminManager, DatabaseSession, TrustedOrigin
from app.models import (
    FAQ,
    Article,
    Country,
    Destination,
    Hotel,
    PublicationStatus,
    Tour,
    TravelService,
)
from app.schemas.destination_management import DestinationWrite
from app.schemas.editorial_management import (
    ArticleWrite,
    FAQWrite,
    HotelWrite,
    TourWrite,
    TravelServiceWrite,
)
from app.services.upload_safety import validate_xlsx_archive

router = APIRouter(prefix="/admin/data-transfer", tags=["admin-data-transfer"])

TransferType = Literal[
    "countries", "destinations", "hotels", "articles", "faqs", "services", "tours"
]

TYPE_LABELS: dict[str, str] = {
    "countries": "Countries",
    "destinations": "Destinations",
    "hotels": "Hotels",
    "articles": "Articles",
    "faqs": "FAQs",
    "services": "Travel services",
    "tours": "Tours",
}

TOUR_IMPORT_LEGACY_COLUMNS = [
    "title",
    "slug",
    "destination_slug",
    "hotel_slug",
    "origin",
    "tour_type",
    "duration_days",
    "departure_date",
    "price_amount",
    "currency",
    "transportation",
    "summary",
    "description",
    "status",
    "is_featured",
]


def _normalize_tour_import_row(row: dict[str, Any]) -> dict[str, Any]:
    """Fill new listing fields when importing a workbook from an older template."""
    return {
        **row,
        "is_installment_available": row.get("is_installment_available") or False,
        "is_direct_flight": row.get("is_direct_flight") or False,
        "is_last_minute": row.get("is_last_minute") or False,
        "badge_label": _blank_to_none(row.get("badge_label")),
        "display_order": row.get("display_order") or 0,
    }


COLUMNS: dict[str, list[str]] = {
    "countries": ["name", "slug", "display_order", "status"],
    "destinations": [
        "title",
        "slug",
        "country",
        "city",
        "summary",
        "description",
        "attractions",
        "best_travel_time",
        "travel_tips",
        "status",
        "is_featured",
    ],
    "hotels": [
        "name",
        "slug",
        "destination_slug",
        "star_rating",
        "summary",
        "description",
        "base_price",
        "currency",
        "max_guests",
        "address",
        "status",
        "is_featured",
    ],
    "articles": [
        "title",
        "slug",
        "category",
        "excerpt",
        "body",
        "author_name",
        "destination_slug",
        "status",
    ],
    "faqs": [
        "question",
        "answer",
        "category",
        "destination_slug",
        "display_order",
        "status",
    ],
    "services": [
        "title",
        "slug",
        "service_type",
        "summary",
        "description",
        "country",
        "origin",
        "destination_name",
        "departure_date",
        "return_date",
        "base_price",
        "currency",
        "provider_company",
        "baggage_allowance",
        "flight_class",
        "status",
    ],
    "tours": [
        "title",
        "slug",
        "destination_slug",
        "hotel_slug",
        "origin",
        "tour_type",
        "duration_days",
        "departure_date",
        "price_amount",
        "currency",
        "transportation",
        "summary",
        "description",
        "status",
        "is_featured",
        "is_installment_available",
        "is_direct_flight",
        "is_last_minute",
        "badge_label",
        "display_order",
    ],
}


def _blank_to_none(value: Any) -> Any:
    return (
        None
        if value is None or (isinstance(value, str) and not value.strip())
        else value
    )


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if str(value).strip().lower() in {"1", "true", "yes", "y", "بله"}:
        return True
    if str(value).strip().lower() in {"0", "false", "no", "n", "خیر", "نه", ""}:
        return False
    raise ValueError("must be true/false")


def _as_date(value: Any) -> date | None:
    value = _blank_to_none(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _workbook(columns: list[str], rows: list[list[Any]], label: str) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = label[:31]
    sheet.append(columns)
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="103A84")
    for row in rows:
        sheet.append(row)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for column in sheet.columns:
        letter = column[0].column_letter
        sheet.column_dimensions[letter].width = min(
            max(len(str(cell.value or "")) for cell in column) + 2, 42
        )
    guide = workbook.create_sheet("Guide")
    guide.append(["Rule", "Value"])
    guide.append(["Import mode", "Create only. Existing slugs are not overwritten."])
    guide.append(["Status", "draft, published, or archived"])
    guide.append(
        [
            "Dates",
            "Use YYYY-MM-DD. Images and galleries remain managed in the admin panel.",
        ]
    )
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _rows_from_upload(content: bytes, data_type: str) -> list[dict[str, Any]]:
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(
            422, "The uploaded file is not a valid .xlsx workbook."
        ) from exc
    sheet = workbook.active
    values = sheet.iter_rows(values_only=True)
    try:
        headers = [
            str(value).strip() if value is not None else "" for value in next(values)
        ]
    except StopIteration as exc:
        raise HTTPException(422, "The workbook is empty.") from exc
    expected = COLUMNS[data_type]
    legacy_tour_template = (
        data_type == "tours" and headers == TOUR_IMPORT_LEGACY_COLUMNS
    )
    if headers != expected and not legacy_tour_template:
        raise HTTPException(422, "Columns do not match this content type template.")
    rows = [
        {key: _blank_to_none(value) for key, value in zip(headers, row, strict=True)}
        for row in values
        if any(value is not None and str(value).strip() for value in row)
    ]
    return (
        [_normalize_tour_import_row(row) for row in rows]
        if legacy_tour_template
        else rows
    )


async def _references(
    session: DatabaseSession,
) -> tuple[dict[str, int], dict[str, int]]:
    destinations = await session.execute(select(Destination.slug, Destination.id))
    hotels = await session.execute(select(Hotel.slug, Hotel.id))
    return dict(destinations), dict(hotels)


def _status(value: Any) -> PublicationStatus:
    return PublicationStatus(str(value or "draft").lower())


async def _make_record(
    session: DatabaseSession,
    data_type: str,
    row: dict[str, Any],
    row_number: int,
    destination_ids: dict[str, int],
    hotel_ids: dict[str, int],
) -> Any:
    try:
        if data_type == "countries":
            status = _status(row["status"])
            return Country(
                name=str(row["name"]),
                slug=str(row["slug"]),
                display_order=int(row["display_order"] or 0),
                status=status,
                published_at=datetime.now(UTC)
                if status == PublicationStatus.PUBLISHED
                else None,
            )
        if data_type == "destinations":
            payload = DestinationWrite.model_validate(
                {
                    **row,
                    "city": _blank_to_none(row["city"]),
                    "attractions": _blank_to_none(row["attractions"]),
                    "best_travel_time": _blank_to_none(row["best_travel_time"]),
                    "travel_tips": _blank_to_none(row["travel_tips"]),
                    "is_featured": _as_bool(row["is_featured"]),
                    "gallery_image_ids": [],
                }
            )
            return Destination(
                **payload.model_dump(exclude={"gallery_image_ids"}),
                published_at=datetime.now(UTC)
                if payload.status == PublicationStatus.PUBLISHED
                else None,
            )
        if data_type == "hotels":
            destination_id = destination_ids.get(str(row["destination_slug"]))
            if destination_id is None:
                raise ValueError("destination_slug does not exist")
            payload = HotelWrite.model_validate(
                {
                    **row,
                    "destination_id": destination_id,
                    "base_price": _blank_to_none(row["base_price"]),
                    "max_guests": _blank_to_none(row["max_guests"]),
                    "address": _blank_to_none(row["address"]),
                    "is_featured": _as_bool(row["is_featured"]),
                    "gallery_image_ids": [],
                }
            )
            return Hotel(
                **payload.model_dump(exclude={"gallery_image_ids", "hotel_code"}),
                hotel_code=f"HTL-{payload.slug[:56].upper()}",
                published_at=datetime.now(UTC)
                if payload.status == PublicationStatus.PUBLISHED
                else None,
            )
        if data_type == "articles":
            destination_slug = row["destination_slug"]
            destination_id = (
                destination_ids.get(str(destination_slug)) if destination_slug else None
            )
            if destination_slug and destination_id is None:
                raise ValueError("destination_slug does not exist")
            payload = ArticleWrite.model_validate(
                {
                    **row,
                    "destination_id": destination_id,
                    "gallery_image_ids": [],
                    "image_id": None,
                }
            )
            return Article(
                **payload.model_dump(exclude={"gallery_image_ids"}),
                published_at=datetime.now(UTC)
                if payload.status == PublicationStatus.PUBLISHED
                else None,
            )
        if data_type == "faqs":
            destination_slug = row["destination_slug"]
            destination_id = (
                destination_ids.get(str(destination_slug)) if destination_slug else None
            )
            if destination_slug and destination_id is None:
                raise ValueError("destination_slug does not exist")
            payload = FAQWrite.model_validate(
                {
                    **row,
                    "destination_id": destination_id,
                    "display_order": int(row["display_order"] or 0),
                    "category": _blank_to_none(row["category"]),
                }
            )
            return FAQ(
                **payload.model_dump(),
                published_at=datetime.now(UTC)
                if payload.status == PublicationStatus.PUBLISHED
                else None,
            )
        if data_type == "services":
            payload = TravelServiceWrite.model_validate(
                {
                    **row,
                    "country": _blank_to_none(row["country"]),
                    "origin": _blank_to_none(row["origin"]),
                    "destination_name": _blank_to_none(row["destination_name"]),
                    "departure_date": _as_date(row["departure_date"]),
                    "return_date": _as_date(row["return_date"]),
                    "base_price": _blank_to_none(row["base_price"]),
                    "provider_company": _blank_to_none(row["provider_company"]),
                    "baggage_allowance": _blank_to_none(row["baggage_allowance"]),
                    "flight_class": _blank_to_none(row["flight_class"]),
                    "gallery_image_ids": [],
                    "image_id": None,
                }
            )
            return TravelService(
                **payload.model_dump(exclude={"gallery_image_ids"}),
                published_at=datetime.now(UTC)
                if payload.status == PublicationStatus.PUBLISHED
                else None,
            )
        destination_slug = row["destination_slug"]
        hotel_slug = row["hotel_slug"]
        destination_id = (
            destination_ids.get(str(destination_slug)) if destination_slug else None
        )
        hotel_id = hotel_ids.get(str(hotel_slug)) if hotel_slug else None
        if destination_slug and destination_id is None:
            raise ValueError("destination_slug does not exist")
        if hotel_slug and hotel_id is None:
            raise ValueError("hotel_slug does not exist")
        status = _status(row["status"] or "published")
        payload = TourWrite.model_validate(
            {
                **row,
                "status": status,
                "destination_id": destination_id,
                "hotel_id": hotel_id,
                "duration_days": _blank_to_none(row["duration_days"]),
                "departure_date": _as_date(row["departure_date"]),
                "price_amount": _blank_to_none(row["price_amount"]),
                "summary": _blank_to_none(row["summary"]),
                "description": _blank_to_none(row["description"]),
                "is_featured": _as_bool(row["is_featured"]),
                "is_installment_available": _as_bool(row["is_installment_available"]),
                "is_direct_flight": _as_bool(row["is_direct_flight"]),
                "is_last_minute": _as_bool(row["is_last_minute"]),
                "badge_label": _blank_to_none(row["badge_label"]),
                "display_order": int(row["display_order"] or 0),
                "gallery_image_ids": [],
            }
        )
        values = payload.model_dump(
            exclude={
                "gallery_image_ids",
                "itinerary_days",
                "departures",
                "hotel_packages",
            }
        )
        return Tour(
            **values,
            external_crm_id=f"excel:{payload.slug}",
            crm_updated_at=datetime.now(UTC),
            published_at=datetime.now(UTC)
            if payload.status == PublicationStatus.PUBLISHED
            else None,
        )
    except (ValidationError, ValueError, TypeError) as exc:
        raise ValueError(f"row {row_number}: {exc}") from exc


def _export_rows(data_type: str, records: list[Any]) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for item in records:
        destination_slug = getattr(getattr(item, "destination", None), "slug", None)
        hotel_slug = getattr(getattr(item, "hotel", None), "slug", None)
        values = {
            "name": getattr(item, "name", None),
            "title": getattr(item, "title", None),
            "slug": item.slug,
            "display_order": getattr(item, "display_order", None),
            "status": item.status.value,
            "country": getattr(item, "country", None),
            "city": getattr(item, "city", None),
            "summary": getattr(item, "summary", None),
            "description": getattr(item, "description", None),
            "attractions": getattr(item, "attractions", None),
            "best_travel_time": getattr(item, "best_travel_time", None),
            "travel_tips": getattr(item, "travel_tips", None),
            "is_featured": getattr(item, "is_featured", False),
            "destination_slug": destination_slug,
            "star_rating": getattr(item, "star_rating", None),
            "base_price": getattr(item, "base_price", None),
            "currency": getattr(item, "currency", None),
            "max_guests": getattr(item, "max_guests", None),
            "address": getattr(item, "address", None),
            "category": getattr(item, "category", None),
            "excerpt": getattr(item, "excerpt", None),
            "body": getattr(item, "body", None),
            "author_name": getattr(item, "author_name", None),
            "question": getattr(item, "question", None),
            "answer": getattr(item, "answer", None),
            "service_type": getattr(item, "service_type", None),
            "origin": getattr(item, "origin", None),
            "destination_name": getattr(item, "destination_name", None),
            "departure_date": getattr(item, "departure_date", None),
            "return_date": getattr(item, "return_date", None),
            "provider_company": getattr(item, "provider_company", None),
            "baggage_allowance": getattr(item, "baggage_allowance", None),
            "flight_class": getattr(item, "flight_class", None),
            "hotel_slug": hotel_slug,
            "tour_type": getattr(item, "tour_type", None),
            "duration_days": getattr(item, "duration_days", None),
            "price_amount": getattr(item, "price_amount", None),
            "transportation": getattr(item, "transportation", None),
        }
        rows.append([values.get(column) for column in COLUMNS[data_type]])
    return rows


async def _records_for_export(session: DatabaseSession, data_type: str) -> list[Any]:
    models = {
        "countries": Country,
        "destinations": Destination,
        "hotels": Hotel,
        "articles": Article,
        "faqs": FAQ,
        "services": TravelService,
        "tours": Tour,
    }
    statement = select(models[data_type]).order_by(models[data_type].id)
    if data_type in {"hotels", "articles", "faqs"}:
        statement = statement.options(joinedload(models[data_type].destination))
    elif data_type == "tours":
        statement = statement.options(
            joinedload(Tour.destination), joinedload(Tour.hotel)
        )
    result = await session.scalars(statement)
    return list(result)


@router.get("/template")
async def download_template(
    data_type: TransferType = Query(alias="type"),
    _admin: AdminManager = None,
) -> Response:
    content = _workbook(COLUMNS[data_type], [], TYPE_LABELS[data_type])
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{data_type}-template.xlsx"'
        },
    )


@router.get("/export")
async def export_records(
    session: DatabaseSession,
    data_type: TransferType = Query(alias="type"),
    _admin: AdminManager = None,
) -> Response:
    content = _workbook(
        COLUMNS[data_type],
        _export_rows(data_type, await _records_for_export(session, data_type)),
        TYPE_LABELS[data_type],
    )
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{data_type}-export.xlsx"'
        },
    )


@router.post("/import")
async def import_records(
    session: DatabaseSession,
    file: UploadFile = File(),
    data_type: TransferType = Query(alias="type"),
    _admin: AdminManager = None,
    _origin: TrustedOrigin = None,
) -> dict[str, Any]:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "Upload an .xlsx file.")
    content = await file.read(5 * 1024 * 1024 + 1)
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(422, "The workbook must be between 1 byte and 5 MB.")
    await asyncio.to_thread(validate_xlsx_archive, content)
    rows = await asyncio.to_thread(_rows_from_upload, content, data_type)
    if not rows:
        raise HTTPException(422, "The workbook has no data rows.")
    if len(rows) > 500:
        raise HTTPException(422, "A workbook can contain at most 500 rows.")
    destination_ids, hotel_ids = await _references(session)
    records: list[Any] = []
    errors: list[dict[str, Any]] = []
    for offset, row in enumerate(rows, start=2):
        try:
            records.append(
                await _make_record(
                    session, data_type, row, offset, destination_ids, hotel_ids
                )
            )
        except ValueError as exc:
            errors.append({"row": offset, "message": str(exc)})
    if errors:
        raise HTTPException(
            422, {"message": "Fix the listed rows and import again.", "errors": errors}
        )
    session.add_all(records)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "A slug, name, or related record already exists."
        ) from exc
    return {"type": data_type, "created": len(records), "mode": "create_only"}
