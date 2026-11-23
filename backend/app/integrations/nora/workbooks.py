"""Native workbook validation with durable, actor-bound preview and replay."""

import asyncio
import base64
import hashlib
import json
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.nora.contracts import WorkbookCommand
from app.integrations.nora.models import NoraOperation, NoraPreview
from app.integrations.nora.security import NoraContext, cipher
from app.integrations.nora.service import NoraService
from app.repositories.combined_excel import uses_combined_prices
from app.services.combined_excel import (
    has_combined_stay_columns,
    parse_combined_workbook,
    upsert_combined_prices,
)
from app.services.excel_pricing import (
    WorkbookValidationError,
    build_tour_price_template,
    parse_hotel_workbook,
    parse_price_workbook,
    upsert_hotels,
    upsert_tour_departure_prices,
)
from app.services.upload_safety import validate_xlsx_archive

TABLES = (
    "countries",
    "destinations",
    "hotels",
    "hotel_rooms",
    "hotel_price_periods",
    "crm_tour_cache",
    "tour_departures",
    "tour_departure_hotel_prices",
    "tour_combined_packages",
    "tour_combined_package_hotels",
    "tour_combined_departure_prices",
)
ASSETS = Path(__file__).resolve().parents[2] / "assets" / "excel"


class DeferredCommit:
    """A native import joins the caller's transaction, including its replay result."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def __getattr__(self, name: str) -> Any:
        return getattr(self.session, name)

    async def commit(self) -> None:
        await self.session.flush()


class WorkbookService:
    """No second workbook parser or business calculation exists in Nora."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.connector = NoraService(session)

    async def snapshot(self, *, lock: bool = False) -> str:
        # These are fixed, application-owned identifiers, never user input.
        if lock:
            await self.session.execute(
                text("LOCK TABLE " + ",".join(TABLES) + " IN SHARE ROW EXCLUSIVE MODE")
            )
        parts = []
        for table in TABLES:
            parts.append(
                await self.session.scalar(
                    text(
                        "SELECT md5(coalesce(string_agg(id::text || ':' || xmin::text, "
                        f"',' ORDER BY id), '')) FROM {table}"
                    )
                )
            )
        return hashlib.sha256(json.dumps(parts).encode()).hexdigest()

    async def template(self, context: NoraContext, kind: str) -> dict[str, str]:
        connection = await self.connector.checked(context)
        target = "hotels" if kind == "hotels" else "tours"
        if kind not in {"hotels", "tour-prices"} or target not in connection.resources:
            raise HTTPException(403, "workbook is not delegated")
        path = ASSETS / (
            "hotel-master-template.xlsx"
            if kind == "hotels"
            else "tour-price-by-date-template-hotel-name.xlsx"
        )
        content = await asyncio.to_thread(path.read_bytes)
        if kind == "tour-prices":
            content = await asyncio.to_thread(build_tour_price_template, content)
        return {"filename": path.name, "content": base64.b64encode(content).decode()}

    async def native(
        self,
        kind: str,
        content: bytes,
        tour_id: int | None,
        *,
        apply: bool,
    ) -> dict[str, Any]:
        await asyncio.to_thread(validate_xlsx_archive, content)
        session = DeferredCommit(self.session) if apply else self.session
        if kind == "hotels":
            rows = await asyncio.to_thread(parse_hotel_workbook, content)
            result = await upsert_hotels(session, rows, commit=apply)
            return {**result, "previewRows": [asdict(row) for row in rows[:50]]}
        if kind != "tour-prices" or tour_id is None:
            raise HTTPException(422, "select a site tour")
        if await uses_combined_prices(self.session, tour_id) or await asyncio.to_thread(
            has_combined_stay_columns, content
        ):
            rows = await asyncio.to_thread(parse_combined_workbook, content, None)
            result = await upsert_combined_prices(session, tour_id, rows, commit=apply)
            return {**result, "previewRows": [asdict(row) for row in rows[:50]]}
        rows = await asyncio.to_thread(parse_price_workbook, content, None)
        result = await upsert_tour_departure_prices(
            session, tour_id, rows, commit=apply
        )
        return {**result, "previewRows": [asdict(row) for row in rows[:50]]}

    async def run(
        self,
        context: NoraContext,
        kind: str,
        command: WorkbookCommand,
    ) -> dict[str, Any]:
        connection = await self.connector.checked(context)
        target = "hotels" if kind == "hotels" else "tours"
        if target not in connection.resources or kind not in {"hotels", "tour-prices"}:
            raise HTTPException(403, "workbook is not delegated")
        if not context.command:
            raise HTTPException(422, "stable operation ID required")
        try:
            content = base64.b64decode(command.content, validate=True)
        except ValueError as exc:
            raise HTTPException(422, "invalid workbook encoding") from exc
        if not content or len(content) > 4 * 1024 * 1024:
            raise HTTPException(413, "workbook exceeds 4 MiB")
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "kind": kind,
                    "actor": context.subject,
                    "branch": context.branch,
                    "command": command.model_dump(mode="json"),
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        previous = await self.connector.repository.operation(
            connection.id, context.command
        )
        if previous:
            if previous.fingerprint != fingerprint:
                raise HTTPException(409, "operation content differs")
            return previous.result
        snapshot = await self.snapshot(lock=command.apply)
        if command.apply:
            preview = await self.session.get(NoraPreview, command.proof or "")
            if (
                preview is None
                or preview.connection_id != context.connection_id
                or preview.branch_id != context.branch
                or preview.subject != context.subject
                or preview.kind != kind
                or preview.expires_at <= datetime.now(UTC)
                or preview.source_revision != snapshot
                or cipher().decrypt(preview.ciphertext.encode()).decode()
                != command.model_copy(
                    update={"apply": False, "proof": None}
                ).model_dump_json()
            ):
                raise HTTPException(
                    409, "preview expired, changed or belongs to another actor"
                )
        try:
            result = await self.native(
                kind, content, command.tour_id, apply=command.apply
            )
        except WorkbookValidationError as exc:
            await self.session.rollback()
            return {
                "proof": None,
                "revision": 1,
                "result": {
                    "valid": False,
                    "applied": False,
                    "warnings": [],
                    "errors": exc.errors,
                },
            }
        # Native preview deliberately rolled back all temporary catalog writes.
        if not command.apply:
            await self.connector.checked(context)
            if await self.snapshot() != snapshot:
                raise HTTPException(409, "catalog changed during preview; try again")
            preview_id = uuid4().hex
            self.session.add(
                NoraPreview(
                    id=preview_id,
                    connection_id=context.connection_id,
                    branch_id=context.branch,
                    subject=context.subject,
                    kind=kind,
                    source_revision=snapshot,
                    ciphertext=cipher()
                    .encrypt(command.model_dump_json().encode())
                    .decode(),
                    expires_at=datetime.now(UTC) + timedelta(hours=1),
                )
            )
        else:
            preview_id = command.proof
        response = {
            "proof": preview_id,
            "revision": 1,
            "result": {
                **result,
                "valid": True,
                "applied": command.apply,
                "warnings": result.get("warnings", []),
                "errors": [],
            },
        }
        # JSON conversion preserves Decimal as strings in native outputs.
        from fastapi.encoders import jsonable_encoder

        response = jsonable_encoder(
            response,
            custom_encoder={
                __import__("decimal").Decimal: str,
            },
        )
        self.session.add(
            NoraOperation(
                connection_id=context.connection_id,
                operation_id=context.command,
                fingerprint=fingerprint,
                result=response,
                created_at=datetime.now(UTC),
            )
        )
        self.connector.repository.audit(
            context.connection_id,
            context.subject,
            "workbook.apply" if command.apply else "workbook.preview",
        )
        await self.session.commit()
        return response
