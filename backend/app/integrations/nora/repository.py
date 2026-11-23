"""Queries and transactional locks for the Nora boundary."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.nora.models import (
    NoraActor,
    NoraAudit,
    NoraConnection,
    NoraNonce,
    NoraOperation,
)
from app.models import AdminSession, AdminUser


class NoraRepository:
    """Keep connector queries out of transport handlers."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def connection(self, connection_id: str) -> NoraConnection | None:
        return await self.session.scalar(
            select(NoraConnection)
            .where(NoraConnection.id == connection_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    async def list_connections(self) -> list[NoraConnection]:
        return list(
            await self.session.scalars(
                select(NoraConnection)
                .where(NoraConnection.deleted_at.is_(None))
                .order_by(NoraConnection.created_at.desc())
                .limit(100)
            )
        )

    async def personal_admin(
        self,
        connection: NoraConnection,
        branch: str,
        subject: str,
        name: str,
    ) -> AdminUser:
        mapping = await self.session.get(NoraActor, (connection.id, branch, subject))
        if mapping is not None:
            return await self.session.get(AdminUser, mapping.admin_id)
        # No local password or SSO session is issued by this connector.
        user = AdminUser(
            # RFC-reserved, schema-valid placeholder; never a real user's mailbox.
            email=f"nora-{uuid4().hex}@example.com",
            full_name=name or f"Nora {subject}",
            password_hash="!nora-no-local-password",
            role="admin",
            can_manage_pricing=True,
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()
        self.session.add(
            NoraActor(
                connection_id=connection.id,
                branch_id=branch,
                subject=subject,
                admin_id=user.id,
            )
        )
        await self.session.flush()
        return user

    async def revoke(self, connection: NoraConnection, *, deleted: bool) -> None:
        now = datetime.now(UTC)
        connection.revoked_at = connection.revoked_at or now
        if deleted:
            connection.deleted_at = now
        connection.version += 1
        users = select(NoraActor.admin_id).where(
            NoraActor.connection_id == connection.id
        )
        await self.session.execute(
            update(AdminUser).where(AdminUser.id.in_(users)).values(is_active=False)
        )
        await self.session.execute(
            update(AdminSession)
            .where(AdminSession.admin_user_id.in_(users))
            .values(revoked_at=now)
        )

    async def remember_nonce(self, connection_id: str, request_id: str) -> None:
        await self.session.execute(
            delete(NoraNonce).where(
                NoraNonce.created_at < datetime.now(UTC) - timedelta(minutes=10)
            )
        )
        self.session.add(
            NoraNonce(
                connection_id=connection_id,
                request_id=request_id,
                created_at=datetime.now(UTC),
            )
        )
        await self.session.flush()

    async def operation(
        self, connection_id: str, operation_id: str
    ) -> NoraOperation | None:
        return await self.session.get(NoraOperation, (connection_id, operation_id))

    def audit(self, connection_id: str, actor: str, action: str) -> None:
        self.session.add(
            NoraAudit(
                id=uuid4().hex,
                connection_id=connection_id,
                actor=actor,
                action=action,
                created_at=datetime.now(UTC),
            )
        )
