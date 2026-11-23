"""Dedicated hotel and date-specific tour pricing Excel endpoints."""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import AdminManager, DatabaseSession, TrustedOrigin
from app.models import Destination, Hotel, PublicationStatus, Tour, TourCombinedPackage
from app.repositories.combined_excel import uses_combined_prices
from app.schemas.combined_excel import CombinedImportResult
from app.services.combined_excel import (
    has_combined_stay_columns,
    parse_combined_workbook,
    upsert_combined_prices,
)
from app.services.combined_excel_template import (
    build_combined_template,
    combined_template_rows,
)
from app.services.excel_pricing import (
    WorkbookValidationError,
    build_hotel_city_template,
    build_tour_price_template,
    parse_hotel_workbook,
    parse_price_workbook,
    upsert_hotels,
    upsert_tour_departure_prices,
)
from app.services.upload_safety import validate_xlsx_archive

router = APIRouter(prefix="/admin/excel", tags=["admin-excel"])
ASSET_DIRECTORY = Path(__file__).resolve().parents[2] / "assets" / "excel"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
logger = logging.getLogger(__name__)


async def _read_xlsx(file: UploadFile) -> bytes:
    if not (file.filename or "").casefold().endswith(".xlsx"):
        raise HTTPException(
            422,
            "فایل باید با پسوند .xlsx ذخیره شده باشد؛ "
            "از Excel گزینهٔ Save As را انتخاب کنید.",
        )
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            422,
            "فایل خالی است یا حجم آن بیشتر از ۵ مگابایت است؛ "
            "فایل کوچک‌تر و دارای داده انتخاب کنید.",
        )
    await asyncio.to_thread(validate_xlsx_archive, content)
    return content


def _validation_error(exc: WorkbookValidationError) -> HTTPException:
    return HTTPException(
        422,
        {
            "message": f"فایل ثبت نشد؛ {len(exc.errors)} خطا پیدا شد. "
            "ردیف‌ها و راه اصلاح را پایین ببینید.",
            "errors": exc.errors,
        },
    )


@router.get("/hotels/template")
async def hotel_template(_admin: AdminManager = None) -> FileResponse:
    return FileResponse(
        ASSET_DIRECTORY / "hotel-master-template.xlsx",
        filename="hotel-master-template.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/hotels/cities")
async def hotel_cities(
    session: DatabaseSession, _admin: AdminManager = None
) -> list[dict[str, Any]]:
    rows = await session.execute(
        select(Destination.id, Destination.city, Destination.title, Destination.country)
        .join(Hotel, Hotel.destination_id == Destination.id)
        .where(Hotel.status != PublicationStatus.ARCHIVED)
        .distinct()
        .order_by(Destination.city, Destination.title, Destination.id)
    )
    return [dict(row._mapping) for row in rows]


@router.get("/hotels/city-template")
async def hotel_city_template(
    session: DatabaseSession,
    destination_id: Annotated[int, Query(alias="destinationId", ge=1)],
    _admin: AdminManager = None,
) -> StreamingResponse:
    destination = await session.get(Destination, destination_id)
    hotels = list(
        await session.scalars(
            select(Hotel)
            .where(
                Hotel.destination_id == destination_id,
                Hotel.status != PublicationStatus.ARCHIVED,
            )
            .order_by(Hotel.name, Hotel.id)
        )
    )
    if destination is None or not hotels:
        raise HTTPException(404, "برای این مقصد هتلی پیدا نشد.")
    content = await asyncio.to_thread(
        build_hotel_city_template,
        ASSET_DIRECTORY / "hotel-master-template.xlsx",
        destination,
        hotels,
    )
    filename = f"hotels-{destination_id}.xlsx"
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/tour-prices/template")
async def tour_price_template(
    session: DatabaseSession,
    tour_id: int = Query(alias="tourId", ge=1),
    combined: bool = False,
    _admin: AdminManager = None,
) -> StreamingResponse:
    tour_exists = await session.scalar(select(Tour.id).where(Tour.id == tour_id))
    if tour_exists is None:
        raise HTTPException(404, "Selected tour was not found.")
    if combined or await uses_combined_prices(session, tour_id):
        try:
            groups = await combined_template_rows(session, tour_id)
        except WorkbookValidationError as exc:
            raise _validation_error(exc) from exc
        content = await asyncio.to_thread(build_combined_template, groups)
    else:
        template_path = ASSET_DIRECTORY / "tour-price-by-date-template-hotel-name.xlsx"
        template_content = await asyncio.to_thread(template_path.read_bytes)
        content = await asyncio.to_thread(build_tour_price_template, template_content)
    filename = f"tour-{tour_id}-prices.xlsx"
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tour-options")
async def tour_options(
    session: DatabaseSession,
    _admin: AdminManager = None,
) -> list[dict[str, Any]]:
    tours = list(
        await session.scalars(
            select(Tour)
            .options(
                selectinload(Tour.departures),
                selectinload(Tour.combined_packages).load_only(TourCombinedPackage.id),
            )
            .order_by(Tour.title, Tour.id)
            .limit(300)
        )
    )
    return [
        {
            "id": tour.id,
            "title": tour.title,
            "isCombinedStay": tour.is_combined_stay or bool(tour.combined_packages),
            "departures": [
                {
                    "id": departure.id,
                    "label": departure.label,
                    "departureDate": departure.departure_date,
                    "nights": departure.nights,
                }
                for departure in tour.departures
                if departure.departure_date is not None
            ],
        }
        for tour in tours
    ]


@router.post("/hotels/import")
async def import_hotels(
    session: DatabaseSession,
    file: Annotated[UploadFile, File()],
    mode: Literal["preview", "commit"] = Query(default="preview"),
    _admin: AdminManager = None,
    _origin: TrustedOrigin = None,
) -> dict[str, Any]:
    try:
        rows = await asyncio.to_thread(parse_hotel_workbook, await _read_xlsx(file))
        result = await upsert_hotels(session, rows, commit=mode == "commit")
    except WorkbookValidationError as exc:
        logger.warning(
            "Excel hotel validation failed mode=%s errors=%s", mode, exc.errors
        )
        raise _validation_error(exc) from exc
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409, "اطلاعات فایل با رکورد موجود تداخل دارد؛ شناسه‌های هتل را بررسی کنید."
        ) from exc
    return {**result, "mode": mode}


@router.post("/tours/{tour_id}/prices/import")
async def import_tour_prices(
    tour_id: int,
    session: DatabaseSession,
    file: Annotated[UploadFile, File()],
    mode: Literal["preview", "commit"] = Query(default="preview"),
    default_currency: Literal["IRT", "USD", "EUR"] | None = Query(
        default=None, alias="defaultCurrency"
    ),
    departure_id: Annotated[int | None, Query(alias="departureId", gt=0)] = None,
    _admin: AdminManager = None,
    _origin: TrustedOrigin = None,
) -> dict[str, Any]:
    try:
        content = await _read_xlsx(file)
        if await uses_combined_prices(session, tour_id) or await asyncio.to_thread(
            has_combined_stay_columns, content
        ):
            combined_rows = await asyncio.to_thread(
                parse_combined_workbook,
                content,
                default_currency if isinstance(default_currency, str) else None,
            )
            result = await upsert_combined_prices(
                session,
                tour_id,
                combined_rows,
                commit=mode == "commit",
                departure_id=departure_id,
            )
            result = CombinedImportResult.model_validate(result).model_dump(
                mode="json", by_alias=True
            )
        else:
            rows = await asyncio.to_thread(
                parse_price_workbook, content, default_currency
            )
            result = await upsert_tour_departure_prices(
                session,
                tour_id,
                rows,
                commit=mode == "commit",
                departure_id=departure_id,
            )
    except WorkbookValidationError as exc:
        logger.warning(
            "Excel price validation failed tour_id=%s mode=%s errors=%s",
            tour_id,
            mode,
            exc.errors,
        )
        raise _validation_error(exc) from exc
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            409,
            "اطلاعات فایل با رکورد موجود تداخل دارد؛ "
            "شناسه‌ها و قیمت‌های تکراری را بررسی کنید.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        reference = uuid4().hex[:12]
        logger.exception(
            "Excel price import failed reference=%s tour_id=%s mode=%s",
            reference,
            tour_id,
            mode,
        )
        raise HTTPException(
            500,
            {
                "message": "ثبت قیمت‌ها به دلیل خطای داخلی انجام نشد؛ "
                "کد پیگیری را برای پشتیبانی ارسال کنید.",
                "reference": reference,
            },
        ) from exc
    logger.info(
        "Excel price import completed tour_id=%s mode=%s rows=%s",
        tour_id,
        mode,
        result.get("rows"),
    )
    return {**result, "mode": mode}
