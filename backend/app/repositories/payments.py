"""Payment persistence isolated from payment-provider and CRM adapters."""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PaymentIntent, PaymentStatus


class PaymentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_pending(
        self,
        *,
        customer_id: int,
        crm_contract_number: str,
        amount: Decimal,
        currency: str,
        provider: str,
    ) -> PaymentIntent:
        payment = PaymentIntent(
            customer_user_id=customer_id,
            crm_contract_number=crm_contract_number,
            amount=amount,
            currency=currency,
            provider=provider,
            status=PaymentStatus.PENDING,
        )
        self.session.add(payment)
        await self.session.flush()
        return payment
