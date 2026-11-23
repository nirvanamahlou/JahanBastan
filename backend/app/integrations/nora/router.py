"""HTTP transport only for the isolated Nora connector."""

import json
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from app.api.dependencies.auth import AdminManager, DatabaseSession, TrustedOrigin
from app.integrations.nora.contracts import (
    IssueConnection,
    LifecycleCommand,
    Rotate,
    WorkbookCommand,
)
from app.integrations.nora.reporting import Heartbeat, ReportingRepository
from app.integrations.nora.security import NoraContext, authenticate
from app.integrations.nora.service import NoraService
from app.integrations.nora.workbooks import WorkbookService

router = APIRouter(tags=["nora-connector"])
BASE = "/integration/nora/v1"


async def authenticated(request: Request, session: DatabaseSession) -> NoraContext:
    return await authenticate(request, session)


Context = Annotated[NoraContext, Depends(authenticated)]


def payload(context: NoraContext) -> dict[str, Any]:
    try:
        value = json.loads(context.body)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "JSON object required") from exc


def validate(schema: Any, context: NoraContext) -> Any:
    try:
        return schema.model_validate(payload(context))
    except ValidationError as exc:
        raise HTTPException(422, "invalid connector command") from exc


@router.get("/admin/nora")
async def list_connections(
    session: DatabaseSession, _admin: AdminManager
) -> dict[str, Any]:
    return await NoraService(session).list()


@router.post("/admin/nora", status_code=201)
async def issue_connection(
    command: IssueConnection,
    session: DatabaseSession,
    admin: AdminManager,
    _origin: TrustedOrigin,
) -> dict[str, Any]:
    return await NoraService(session).issue(command, admin)


@router.post("/admin/nora/{connection_id}/lifecycle")
async def admin_lifecycle(
    connection_id: str,
    command: LifecycleCommand,
    session: DatabaseSession,
    admin: AdminManager,
    _origin: TrustedOrigin,
) -> dict[str, Any]:
    return await NoraService(session).lifecycle(connection_id, command, str(admin.id))


@router.get(BASE + "/capabilities")
async def capabilities(context: Context, session: DatabaseSession) -> dict[str, Any]:
    return await NoraService(session).capabilities(context)


@router.post(BASE + "/renew")
async def renew(context: Context, session: DatabaseSession) -> dict[str, Any]:
    return await NoraService(session).renew(context, validate(Rotate, context))


@router.post(BASE + "/lifecycle")
async def lifecycle(context: Context, session: DatabaseSession) -> dict[str, Any]:
    # Bearer delegation includes management of this connection, never others.
    return await NoraService(session).lifecycle(
        context.connection_id, validate(LifecycleCommand, context), context.subject
    )


@router.get(BASE + "/resources/{resource}")
async def resources(
    resource: str,
    context: Context,
    session: DatabaseSession,
    after_id: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=50),
    report_metric: str | None = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
    q: str = Query(default="", max_length=100),
    status: str | None = Query(default=None, pattern="^(draft|published|archived)$"),
) -> dict[str, Any]:
    if report_metric:
        connection = await NoraService(session).checked(context)
        if (
            resource not in connection.resources
            or "site-analytics" not in connection.resources
        ):
            raise HTTPException(403, "report is not delegated")
        return await ReportingRepository(session).details(
            resource, after_id, report_metric, from_date, to_date
        )
    return await NoraService(session).resources(
        context, resource, after_id, None, q, status
    )


@router.get(BASE + "/resources/{resource}/{record_id}")
async def resource_detail(
    resource: str,
    record_id: int,
    context: Context,
    session: DatabaseSession,
) -> dict[str, Any]:
    return await NoraService(session).resources(context, resource, 0, record_id)


@router.get(BASE + "/catalogue/{resource}/schema")
async def schema(
    resource: str, context: Context, session: DatabaseSession
) -> dict[str, Any]:
    return await NoraService(session).schema(context, resource)


@router.get(BASE + "/catalogue/{resource}/value/{record_id}")
async def editor_value(
    resource: str,
    record_id: int,
    context: Context,
    session: DatabaseSession,
) -> dict[str, Any]:
    return await NoraService(session).resources(context, resource, 0, record_id)


@router.post(BASE + "/catalogue/{resource}")
async def create_record(
    resource: str,
    context: Context,
    session: DatabaseSession,
) -> dict[str, Any]:
    return await NoraService(session).save(context, resource, None, payload(context))


@router.patch(BASE + "/catalogue/{resource}/{record_id}")
async def update_record(
    resource: str,
    record_id: int,
    context: Context,
    session: DatabaseSession,
) -> dict[str, Any]:
    return await NoraService(session).save(
        context, resource, record_id, payload(context)
    )


@router.get(BASE + "/workbooks/{kind}/template")
async def template(
    kind: str, context: Context, session: DatabaseSession
) -> dict[str, str]:
    return await WorkbookService(session).template(context, kind)


@router.post(BASE + "/workbooks/{kind}")
async def workbook(
    kind: str, context: Context, session: DatabaseSession
) -> dict[str, Any]:
    return await WorkbookService(session).run(
        context, kind, validate(WorkbookCommand, context)
    )


@router.get(BASE + "/dashboard")
async def dashboard(context: Context, session: DatabaseSession) -> dict[str, Any]:
    state = await NoraService(session).capabilities(context)
    return {
        "checkedAt": state["createdAt"],
        "metrics": [],
        "imports": [
            {"kind": kind, "canApply": True, "canExport": False}
            for kind, target in (("hotels", "hotels"), ("tour-prices", "tours"))
            if target in state["resources"]
        ],
    }


@router.get(BASE + "/presence")
async def presence(context: Context, session: DatabaseSession) -> dict[str, Any]:
    connection = await NoraService(session).checked(context)
    if "site-analytics" not in connection.resources:
        raise HTTPException(403, "analytics is not delegated")
    return await ReportingRepository(session).presence()


@router.get(BASE + "/report")
async def report(
    context: Context,
    session: DatabaseSession,
    from_date: Annotated[date, Query(alias="from")],
    to_date: Annotated[date, Query(alias="to")],
) -> dict[str, Any]:
    connection = await NoraService(session).checked(context)
    if "site-analytics" not in connection.resources:
        raise HTTPException(403, "analytics is not delegated")
    return await ReportingRepository(session).report(from_date, to_date)


@router.post("/activity/nora-presence", status_code=204)
async def heartbeat(
    command: Heartbeat,
    session: DatabaseSession,
    _origin: TrustedOrigin,
) -> None:
    await ReportingRepository(session).heartbeat(command)


@router.get(BASE + "/business/{path:path}")
@router.post(BASE + "/business/{path:path}")
@router.put(BASE + "/business/{path:path}")
@router.patch(BASE + "/business/{path:path}")
@router.delete(BASE + "/business/{path:path}")
@router.post(BASE + "/events")
async def disabled(context: Context, session: DatabaseSession, path: str = "") -> None:
    await NoraService(session).checked(context)
    raise HTTPException(
        501, "BUSINESS_CAPABILITY_DISABLED: no business request was accepted or queued"
    )
