"""Connection lifecycle and idempotent native integration operations."""

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.nora.catalog import CATALOG, CatalogRepository, save_native
from app.integrations.nora.contracts import (
    CONTRACT,
    FUTURE,
    SITE_ID,
    IssueConnection,
    LifecycleCommand,
    Rotate,
)
from app.integrations.nora.deployment import readiness, require_ready
from app.integrations.nora.models import NoraConnection, NoraInstallation, NoraOperation
from app.integrations.nora.repository import NoraRepository
from app.integrations.nora.security import (
    NoraContext,
    cipher,
    key_hash,
    valid_connection,
)
from app.models import AdminUser


def metadata(connection: NoraConnection) -> dict[str, Any]:
    """Explicit whitelist: neither bearer nor signing ciphertext can be returned."""
    return {
        "contract": CONTRACT,
        "siteId": connection.site_id,
        "organizationId": connection.organization_id,
        "environment": connection.environment,
        "connectionId": connection.id,
        "noraOrigin": connection.nora_origin,
        "resources": connection.resources,
        "expiresAt": connection.expires_at.isoformat(),
        "version": connection.version,
        "createdAt": connection.created_at.isoformat(),
        "lastRenewedAt": connection.renewed_at.isoformat()
        if connection.renewed_at
        else None,
        "state": "DELETED"
        if connection.deleted_at
        else "DISCONNECTED"
        if connection.revoked_at
        else "EXPIRED"
        if connection.expires_at <= datetime.now(UTC)
        else "ACTIVE",
    }


class NoraService:
    """No dependency on payment, finance, reservations, suppliers or issuance."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = NoraRepository(session)

    async def issue(self, payload: IssueConnection, admin: AdminUser) -> dict[str, Any]:
        deployment = require_ready()
        encryption = cipher()
        settings = get_settings()
        await self.session.execute(
            insert(NoraInstallation)
            .values(id=1, organization_id=str(uuid4()))
            .on_conflict_do_nothing(index_elements=["id"])
        )
        installation = await self.session.get(NoraInstallation, 1)
        key, signing = secrets.token_urlsafe(48), secrets.token_urlsafe(48)
        connection = NoraConnection(
            id=uuid4().hex,
            site_id=SITE_ID,
            organization_id=installation.organization_id,
            environment=settings.APP_ENV,
            nora_origin=payload.nora_origin,
            key_hash=key_hash(key),
            signing_ciphertext=encryption.encrypt(signing.encode()).decode(),
            resources=list(dict.fromkeys(payload.resources)),
            issuer_id=admin.id,
            expires_at=datetime.now(UTC) + timedelta(days=90),
            version=1,
        )
        self.session.add(connection)
        await self.session.flush()
        self.repository.audit(connection.id, str(admin.id), "connection.issue")
        await self.session.commit()
        return {
            **metadata(connection),
            "origin": deployment["origin"],
            "apiBase": "/api/v1/integration/nora/v1",
            "apiKey": key,
            "signingKey": signing,
        }

    async def list(self) -> dict[str, Any]:
        deployment = readiness()
        return {
            "contract": CONTRACT,
            "siteId": SITE_ID,
            "origin": deployment["origin"],
            "deployment": deployment,
            "connections": [
                metadata(c) for c in await self.repository.list_connections()
            ],
        }

    async def lifecycle(
        self,
        connection_id: str,
        payload: LifecycleCommand,
        actor: str,
    ) -> dict[str, Any]:
        connection = await self.repository.connection(connection_id)
        if connection is None:
            raise HTTPException(404, "connection not found")
        operation_id = "lifecycle:" + str(payload.operation_id)
        fingerprint = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
        previous = await self.repository.operation(connection.id, operation_id)
        if previous:
            if previous.fingerprint != fingerprint:
                raise HTTPException(409, "operation content differs")
            return previous.result
        if (
            connection.version != payload.expected_version
            and connection.revoked_at is None
        ):
            raise HTTPException(409, "connection changed; reload")
        await self.repository.revoke(connection, deleted=payload.action == "delete")
        result = metadata(connection)
        self.session.add(
            NoraOperation(
                connection_id=connection.id,
                operation_id=operation_id,
                fingerprint=fingerprint,
                result=result,
                created_at=datetime.now(UTC),
            )
        )
        self.repository.audit(connection.id, actor, "connection." + payload.action)
        await self.session.commit()
        return result

    async def checked(self, context: NoraContext) -> NoraConnection:
        connection = valid_connection(
            await self.repository.connection(context.connection_id)
        )
        user = await self.session.get(
            AdminUser, context.admin_id, populate_existing=True, with_for_update=True
        )
        issuer = await self.session.get(
            AdminUser,
            connection.issuer_id,
            populate_existing=True,
            with_for_update=True,
        )
        if (
            user is None
            or not user.is_active
            or user.role not in {"admin", "super_admin"}
            or issuer is None
            or not issuer.is_active
            or issuer.role not in {"admin", "super_admin"}
        ):
            raise HTTPException(403, "personal identity or delegation is disabled")
        return connection

    async def capabilities(self, context: NoraContext) -> dict[str, Any]:
        connection = await self.checked(context)
        return {
            **metadata(connection),
            "grants": [
                f"{r}.{action}"
                for r in connection.resources
                for action in ("read", "write")
                if action == "read" or r in CATALOG
            ],
            "capabilities": {
                **{r: "ACTIVE" for r in connection.resources},
                **{r: "DISABLED" for r in FUTURE},
                "sso": "DISABLED",
            },
            "actor": {"subject": context.subject, "branchId": context.branch},
        }

    async def renew(self, context: NoraContext, payload: Rotate) -> dict[str, Any]:
        connection = await self.checked(context)
        candidate_hash = key_hash(payload.next_api_key)
        if candidate_hash != connection.key_hash:
            connection.key_hash = candidate_hash
            connection.expires_at = datetime.now(UTC) + timedelta(days=90)
            connection.renewed_at = datetime.now(UTC)
            connection.version += 1
            self.repository.audit(connection.id, context.subject, "connection.renew")
        # Same candidate acknowledges a committed rotation without extending it.
        result = {**metadata(connection), "renewal": "rotate.v1"}
        await self.session.commit()
        return result

    async def resources(
        self,
        context: NoraContext,
        resource: str,
        after: int,
        record_id: int | None,
        query: str = "",
        status: str | None = None,
    ) -> dict[str, Any]:
        connection = await self.checked(context)
        if resource not in connection.resources:
            raise HTTPException(403, "resource is outside connection delegation")
        repository = CatalogRepository(self.session)
        if resource in {"customer-accounts", "customer-orders"}:
            from app.integrations.nora.reporting import ReportingRepository

            return await ReportingRepository(self.session).details(
                resource, after, record_id=record_id
            )
        return (
            await repository.value(resource, record_id)
            if record_id
            else await repository.list(resource, after, query=query, status=status)
        )

    async def schema(self, context: NoraContext, resource: str) -> dict[str, Any]:
        connection = await self.checked(context)
        if resource not in connection.resources or resource not in CATALOG:
            raise HTTPException(403, "resource is not writable")
        spec = CATALOG[resource]
        return {
            "resource": resource,
            "contractVersion": 1,
            "schemaVersion": 1,
            "title": resource,
            "canCreate": True,
            "canUpdate": True,
            "groups": {},
            "canPublish": True,
            "createSchema": spec[1].model_json_schema(by_alias=False),
            "updateSchema": spec[2].model_json_schema(by_alias=False),
            "lookups": {"destination_id": "destinations", "hotel_id": "hotels"},
        }

    async def save(
        self,
        context: NoraContext,
        resource: str,
        record_id: int | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        connection = await self.checked(context)
        if resource not in connection.resources:
            raise HTTPException(403, "resource not delegated")
        if not context.command:
            raise HTTPException(422, "stable operation ID required")
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "resource": resource,
                    "id": record_id,
                    "version": context.version,
                    "branch": context.branch,
                    "subject": context.subject,
                    "value": payload,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).hexdigest()
        previous = await self.repository.operation(connection.id, context.command)
        if previous:
            if previous.fingerprint != fingerprint:
                raise HTTPException(409, "operation ID was used with different content")
            return previous.result
        admin = await self.session.get(AdminUser, context.admin_id)
        result = await save_native(
            self.session, resource, admin, payload, record_id, context.version
        )
        self.session.add(
            NoraOperation(
                connection_id=connection.id,
                operation_id=context.command,
                fingerprint=fingerprint,
                result=result,
                created_at=datetime.now(UTC),
            )
        )
        self.repository.audit(
            connection.id, context.subject, "catalogue.save." + resource
        )
        await self.session.commit()
        return result
