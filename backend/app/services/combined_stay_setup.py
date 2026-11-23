"""Create missing stays only from explicit, validated workbook definitions."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Hotel, TourCombinedPackage, TourCombinedPackageHotel
from app.repositories.combined_excel import load_import_hotels
from app.services.combined_hotel_names import combined_hotel_key
from app.services.excel_pricing import WorkbookValidationError

if TYPE_CHECKING:
    from app.services.combined_excel import CombinedImportRow


async def prepare_stays(
    session: AsyncSession,
    tour_id: int,
    rows: list[CombinedImportRow],
    packages: list[TourCombinedPackage],
) -> int:
    from app.services.combined_excel import _matching_assignments

    pending = [
        row for row in rows if not any(_matching_assignments(row, p) for p in packages)
    ]
    if not pending:
        return 0
    hotels = await load_import_hotels(session)
    by_name: dict[str, list[Hotel]] = {}
    for hotel in hotels:
        by_name.setdefault(combined_hotel_key(hotel.name), []).append(hotel)
    errors = []
    planned = {}
    for row in pending:
        resolved = []
        patterns = {
            tuple(h.nights for h in p.hotels)
            for p in packages
            if len(p.hotels) == len(row.hotels)
        }
        inherited = next(iter(patterns)) if len(patterns) == 1 else None
        for position, entry in enumerate(row.hotels):
            if entry.nights is None and inherited is not None:
                entry = replace(entry, nights=inherited[position])
            candidates = by_name.get(combined_hotel_key(entry.hotel_name or ""), [])
            if len(candidates) != 1:
                errors.append(
                    {
                        "row": entry.row_number,
                        "message": (
                            f"نام دقیق و یکتای هتل لازم است: {entry.hotel_name}. از "
                            "قالب دانلودی و نام‌های سایت استفاده کنید."
                        ),
                    }
                )
                continue
            if entry.nights is None:
                errors.append(
                    {
                        "row": entry.row_number,
                        "message": (
                            "تعداد شب اقامت در تنظیمات تور مشخص یا یکسان نیست؛ "
                            "تقسیم شب‌ها را برای تور مشخص کنید."
                        ),
                    }
                )
                continue
            resolved.append((entry, candidates[0]))
        if len(resolved) != len(row.hotels):
            continue
        key = tuple(sorted(hotel.id for _, hotel in resolved))
        if len(set(key)) != len(key):
            errors.append(
                {"row": row.row_number, "message": "یک هتل در ترکیب تکرار شده است."}
            )
            continue
        signature = tuple((h.id, e.nights, e.service_type) for e, h in resolved)
        if key in planned and planned[key][0] != signature:
            errors.append(
                {
                    "row": row.row_number,
                    "message": "اقامت یک ترکیب در تاریخ‌های فایل یکسان نیست.",
                }
            )
        planned[key] = (signature, resolved)
    if len(packages) + len(planned) > 100:
        errors.append({"row": 1, "message": "حداکثر ۱۰۰ ترکیب در هر تور مجاز است."})
    if errors:
        await session.rollback()
        raise WorkbookValidationError(errors)
    next_order = max((p.display_order for p in packages), default=-1) + 1
    for _, resolved in planned.values():
        package = TourCombinedPackage(
            tour_id=tour_id,
            title=" + ".join(h.name for _, h in resolved)[:160],
            display_order=next_order,
            hotels=[
                TourCombinedPackageHotel(
                    hotel=h,
                    hotel_id=h.id,
                    nights=e.nights,
                    board_type=e.service_type,
                    display_order=i,
                )
                for i, (e, h) in enumerate(resolved)
            ],
        )
        session.add(package)
        packages.append(package)
        next_order += 1
    return len(planned)
