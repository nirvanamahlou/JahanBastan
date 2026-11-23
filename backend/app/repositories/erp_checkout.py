"""Short-transaction persistence for customer-owned ERP checkouts."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CustomerPassenger, ErpFlightCheckout


class ErpCheckoutRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def recent(self, customer_id: int) -> list[ErpFlightCheckout]:
        return list(
            (
                await self.session.scalars(
                    select(ErpFlightCheckout)
                    .where(ErpFlightCheckout.customer_id == customer_id)
                    .order_by(ErpFlightCheckout.created_at.desc(), ErpFlightCheckout.id)
                    .limit(30)
                )
            ).all()
        )

    async def cancelled(self, rows: list[ErpFlightCheckout]) -> set[str]:
        contracts = {
            r.external_id: r.erp_contract_id for r in rows if r.erp_contract_id
        }
        if not contracts:
            return set()
        results = await self.session.execute(
            text("""
            SELECT item->>'externalId', item->>'contractId'
            FROM rubi_catalog_receipt,
                 jsonb_array_elements(
                    CASE WHEN jsonb_typeof(snapshot->'cancelledOrders') = 'array'
                         THEN snapshot->'cancelledOrders' ELSE '[]'::jsonb END
                 ) AS entries(item)
            WHERE site = 'jahan-bastan'
              AND item->>'externalId' = ANY(CAST(:ids AS text[]))
        """),
            {"ids": list(contracts)},
        )
        return {
            external_id
            for external_id, contract_id in results
            if contract_id and contracts.get(external_id) == contract_id
        }

    async def get(self, checkout_id: UUID) -> ErpFlightCheckout | None:
        row = await self.session.scalar(
            select(ErpFlightCheckout)
            .where(ErpFlightCheckout.id == checkout_id)
            .execution_options(populate_existing=True)
        )
        await self.session.commit()
        return row

    async def owned(
        self, checkout_id: UUID, customer_id: int
    ) -> ErpFlightCheckout | None:
        row = await self.session.scalar(
            select(ErpFlightCheckout)
            .where(
                ErpFlightCheckout.id == checkout_id,
                ErpFlightCheckout.customer_id == customer_id,
            )
            .execution_options(populate_existing=True)
        )
        await self.session.commit()
        return row

    async def passengers(
        self, customer_id: int, ids: list[int]
    ) -> list[CustomerPassenger]:
        rows = list(
            (
                await self.session.scalars(
                    select(CustomerPassenger).where(
                        CustomerPassenger.customer_id == customer_id,
                        CustomerPassenger.id.in_(ids),
                    )
                )
            ).all()
        )
        await self.session.commit()
        return rows

    async def insert(self, row: ErpFlightCheckout) -> ErpFlightCheckout:
        self.session.add(row)
        try:
            await self.session.commit()
            return row
        except IntegrityError:
            await self.session.rollback()
            existing = await self.get(row.id)
            if existing is None:
                raise
            return existing

    async def claim(
        self, checkout_id: UUID, target: str, allowed: set[str]
    ) -> str | None:
        token = uuid4().hex
        now = datetime.now(UTC)
        result = await self.session.execute(
            update(ErpFlightCheckout)
            .where(
                ErpFlightCheckout.id == checkout_id,
                ErpFlightCheckout.state.in_(allowed),
                or_(
                    ErpFlightCheckout.state.not_in({"preparing", "dispatching"}),
                    ErpFlightCheckout.lease_expires_at < now,
                    ErpFlightCheckout.lease_expires_at.is_(None),
                ),
            )
            .values(
                state=target,
                lease_token=token,
                lease_expires_at=now + timedelta(seconds=45),
                updated_at=now,
                error_code=None,
                error_message=None,
                error_retryable=False,
            )
        )
        await self.session.commit()
        return token if result.rowcount == 1 else None

    async def store_payload(
        self, checkout_id: UUID, token: str, payload: dict[str, Any]
    ) -> None:
        await self.session.execute(
            update(ErpFlightCheckout)
            .where(
                ErpFlightCheckout.id == checkout_id,
                ErpFlightCheckout.state == "preparing",
                ErpFlightCheckout.lease_token == token,
                ErpFlightCheckout.erp_payload.is_(None),
            )
            .values(
                erp_payload=payload,
                state="prepared",
                lease_token=None,
                lease_expires_at=None,
                updated_at=datetime.now(UTC),
            )
        )
        await self.session.commit()

    async def complete(
        self, checkout_id: UUID, token: str, response: dict[str, Any]
    ) -> None:
        data = response.get("data") or {}
        await self.session.execute(
            update(ErpFlightCheckout)
            .where(
                ErpFlightCheckout.id == checkout_id,
                ErpFlightCheckout.lease_token == token,
            )
            .values(
                state="draft",
                lease_token=None,
                lease_expires_at=None,
                erp_contract_id=data.get("contractId"),
                erp_contract_number=data.get("contractNumber"),
                erp_status=data.get("status"),
                updated_at=datetime.now(UTC),
            )
        )
        await self.session.commit()

    async def fail(
        self,
        checkout_id: UUID,
        token: str,
        *,
        code: str,
        message: str,
        uncertain: bool,
        retryable: bool,
    ) -> None:
        await self.session.execute(
            update(ErpFlightCheckout)
            .where(
                ErpFlightCheckout.id == checkout_id,
                ErpFlightCheckout.lease_token == token,
            )
            .values(
                state="uncertain" if uncertain else "failed",
                lease_token=None,
                lease_expires_at=None,
                error_code=code,
                error_message=message,
                error_retryable=retryable,
                updated_at=datetime.now(UTC),
            )
        )
        await self.session.commit()
