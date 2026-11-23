"""Database access for admin users and sessions."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import AdminPasswordResetCode, AdminSession, AdminUser


class AdminUserRepository:
    """Query and persist administrative users."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> AdminUser | None:
        """Return one user by normalized email."""
        statement = select(AdminUser).where(
            func.lower(AdminUser.email) == email.lower()
        )
        return await self.session.scalar(statement)

    async def get_by_id(self, user_id: int) -> AdminUser | None:
        """Return one administrative user by primary key."""
        return await self.session.get(AdminUser, user_id)

    async def list(self, *, limit: int, offset: int) -> tuple[list[AdminUser], int]:
        """Return a bounded user page and total count."""
        statement = (
            select(AdminUser)
            .order_by(AdminUser.created_at.desc(), AdminUser.id.desc())
            .limit(limit)
            .offset(offset)
        )
        users = list((await self.session.scalars(statement)).all())
        total = await self.session.scalar(select(func.count(AdminUser.id)))
        return users, int(total or 0)

    async def count_active_super_admins(self) -> int:
        """Count accounts capable of managing all administrators."""
        statement = select(func.count(AdminUser.id)).where(
            AdminUser.role == "super_admin",
            AdminUser.is_active.is_(True),
        )
        return int(await self.session.scalar(statement) or 0)

    async def create(
        self,
        *,
        email: str,
        full_name: str,
        password_hash: str,
        role: str,
    ) -> AdminUser:
        """Create and stage a new administrative user."""
        user = AdminUser(
            email=email.lower(),
            full_name=full_name,
            password_hash=password_hash,
            role=role,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def revoke_sessions(self, user_id: int) -> None:
        """Revoke all active sessions owned by a user."""
        now = datetime.now(UTC)
        await self.session.execute(
            update(AdminSession)
            .where(
                AdminSession.admin_user_id == user_id,
                AdminSession.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

    async def delete(self, user_id: int) -> None:
        """Delete the account while database foreign keys preserve audit records."""
        await self.revoke_sessions(user_id)
        await self.session.execute(delete(AdminUser).where(AdminUser.id == user_id))


class AdminSessionRepository:
    """Query and persist revocable administrator sessions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> AdminSession:
        """Create and stage a session."""
        admin_session = AdminSession(
            admin_user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.session.add(admin_session)
        await self.session.flush()
        return admin_session

    async def get_active(
        self, token_hash: str, *, idle_minutes: int | None = None
    ) -> AdminSession | None:
        """Load an active session and its user in one query."""
        now = datetime.now(UTC)
        conditions = [
            AdminSession.token_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
        ]
        if idle_minutes is not None:
            conditions.append(
                func.coalesce(AdminSession.last_seen_at, AdminSession.created_at)
                > now - timedelta(minutes=idle_minutes)
            )
        statement = (
            select(AdminSession)
            .options(joinedload(AdminSession.user))
            .where(*conditions)
        )
        return await self.session.scalar(statement)

    async def touch(self, session_id: int) -> None:
        """Refresh the idle-session timestamp without extending absolute expiry."""
        await self.session.execute(
            update(AdminSession)
            .where(AdminSession.id == session_id, AdminSession.revoked_at.is_(None))
            .values(last_seen_at=datetime.now(UTC))
        )

    async def revoke(self, token_hash: str) -> None:
        """Revoke one session if it exists."""
        await self.session.execute(
            update(AdminSession)
            .where(
                AdminSession.token_hash == token_hash,
                AdminSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )


class AdminPasswordResetCodeRepository:
    """Persistence for administrator recovery codes; raw codes are never stored."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def invalidate_active_for_admin(self, admin_user_id: int) -> None:
        await self.session.execute(
            update(AdminPasswordResetCode)
            .where(
                AdminPasswordResetCode.admin_user_id == admin_user_id,
                AdminPasswordResetCode.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )

    async def create(
        self, *, admin_user_id: int, code_hash: str, expires_at: datetime
    ) -> AdminPasswordResetCode:
        code = AdminPasswordResetCode(
            admin_user_id=admin_user_id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self.session.add(code)
        await self.session.flush()
        return code

    async def get_active(self, admin_user_id: int) -> AdminPasswordResetCode | None:
        statement = (
            select(AdminPasswordResetCode)
            .where(
                AdminPasswordResetCode.admin_user_id == admin_user_id,
                AdminPasswordResetCode.used_at.is_(None),
                AdminPasswordResetCode.expires_at > datetime.now(UTC),
            )
            .order_by(
                AdminPasswordResetCode.created_at.desc(),
                AdminPasswordResetCode.id.desc(),
            )
            .limit(1)
        )
        return await self.session.scalar(statement)

    async def register_failed_attempt(
        self, code: AdminPasswordResetCode, *, max_attempts: int
    ) -> None:
        code.attempts += 1
        if code.attempts >= max_attempts:
            code.used_at = datetime.now(UTC)

    async def invalidate(self, code_id: int) -> None:
        """Invalidate one code without affecting a newer recovery request."""
        await self.session.execute(
            update(AdminPasswordResetCode)
            .where(
                AdminPasswordResetCode.id == code_id,
                AdminPasswordResetCode.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )

    async def consume(self, code: AdminPasswordResetCode) -> None:
        code.used_at = datetime.now(UTC)
