"""Transactional access to manually managed exchange rates."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminUser, ExchangeRate, SiteSetting


class ExchangeRateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_current(self) -> list[tuple[ExchangeRate, str | None]]:
        rows = await self.session.execute(
            select(ExchangeRate, AdminUser.full_name)
            .outerjoin(AdminUser, AdminUser.id == ExchangeRate.updated_by_admin_id)
            .order_by(ExchangeRate.currency_code)
        )
        return list(rows.all())

    async def set_rate(
        self, currency_code: str, rate_toman: Decimal, *, admin_id: int
    ) -> ExchangeRate:
        code = currency_code.upper()
        if code not in {"USD", "EUR"}:
            raise ValueError("only USD and EUR are supported")
        item = await self.session.scalar(
            select(ExchangeRate)
            .where(ExchangeRate.currency_code == code)
            .with_for_update()
        )
        if item is None:
            item = ExchangeRate(
                currency_code=code,
                rate_toman=rate_toman,
                updated_by_admin_id=admin_id,
            )
            self.session.add(item)
        else:
            item.rate_toman = rate_toman
            item.updated_by_admin_id = admin_id
        settings = await self.session.get(SiteSetting, 1, with_for_update=True)
        if settings is not None:
            links = dict(settings.social_links or {})
            links[f"exchangeRate{code.title()}Irt"] = str(rate_toman)
            settings.social_links = links
        await self.session.flush()
        return item

    async def snapshot(self) -> dict[str, str]:
        rows = await self.session.execute(
            select(ExchangeRate.currency_code, ExchangeRate.rate_toman)
        )
        return {code: str(rate) for code, rate in rows.all()}
