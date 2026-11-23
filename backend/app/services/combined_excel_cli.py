"""Preview or apply a combined workbook using the same validated admin importer.

Example: python -m app.services.combined_excel_cli /tmp/prices.xlsx --tour-id 49
Explicit --date values replace workbook dates; --commit is required to save.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import replace
from pathlib import Path

from app.db.session import engine, session_factory
from app.services.combined_excel import parse_combined_workbook, upsert_combined_prices
from app.services.excel_pricing import WorkbookValidationError, parse_departure_date


async def run(args: argparse.Namespace) -> None:
    content = await asyncio.to_thread(args.file.read_bytes)
    rows = await asyncio.to_thread(parse_combined_workbook, content, args.currency)
    if args.date:
        if len({row.departure_date for row in rows}) != 1:
            raise ValueError("Date override requires a single-date source workbook.")
        dates = list(dict.fromkeys(parse_departure_date(value) for value in args.date))
        rows = [replace(row, departure_date=day) for day in dates for row in rows]
    try:
        async with session_factory() as session:
            result = await upsert_combined_prices(
                session, args.tour_id, rows, commit=args.commit
            )
        print(
            json.dumps(
                {"saved": args.commit, **result}, ensure_ascii=False, default=str
            )
        )
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--tour-id", type=int, required=True)
    parser.add_argument("--currency", choices=["USD", "EUR", "IRT", "IRR"])
    parser.add_argument(
        "--date",
        action="append",
        help="Explicit target Jalali or Gregorian date; repeat for multiple dates",
    )
    parser.add_argument(
        "--commit", action="store_true", help="Save; otherwise preview and roll back"
    )
    args = parser.parse_args()
    try:
        asyncio.run(run(args))
    except WorkbookValidationError as exc:
        print(
            json.dumps(
                {"saved": False, "errors": exc.errors}, ensure_ascii=False, default=str
            )
        )
        raise SystemExit(1) from exc
    except (OSError, ValueError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
