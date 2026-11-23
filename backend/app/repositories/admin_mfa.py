"""Persistence operations for administrator multi-factor authentication."""

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AdminMfaCredential


class AdminMfaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_for_admin(self, admin_user_id: int) -> AdminMfaCredential | None:
        return await self.session.scalar(
            select(AdminMfaCredential).where(
                AdminMfaCredential.admin_user_id == admin_user_id
            )
        )

    async def store_pending(
        self, *, admin_user_id: int, secret_ciphertext: str
    ) -> AdminMfaCredential:
        credential = await self.get_for_admin(admin_user_id)
        if credential is None:
            credential = AdminMfaCredential(
                admin_user_id=admin_user_id,
                secret_ciphertext=secret_ciphertext,
                is_enabled=False,
            )
            self.session.add(credential)
        else:
            credential.secret_ciphertext = secret_ciphertext
            credential.is_enabled = False
            credential.enabled_at = None
        await self.session.flush()
        return credential

    async def enable(self, credential: AdminMfaCredential) -> None:
        credential.is_enabled = True
        credential.enabled_at = datetime.now(UTC)
        await self.session.flush()

    async def delete_for_admin(self, admin_user_id: int) -> None:
        await self.session.execute(
            delete(AdminMfaCredential).where(
                AdminMfaCredential.admin_user_id == admin_user_id
            )
        )
