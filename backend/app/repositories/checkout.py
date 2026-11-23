"""Persistence for checkout configuration, documents, schedules, and audit."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BookingRequest
from app.models.checkout import (
    BookingDocument,
    BookingDocumentRequirement,
    BookingInstallment,
    BookingStatusEvent,
)
from app.schemas.checkout import DocumentRequirementWrite, InstallmentQuote


class CheckoutRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_requirements(
        self, *, active_only: bool = True
    ) -> list[BookingDocumentRequirement]:
        query = select(BookingDocumentRequirement)
        if active_only:
            query = query.where(BookingDocumentRequirement.is_active.is_(True))
        query = query.order_by(
            BookingDocumentRequirement.display_order,
            BookingDocumentRequirement.id,
        )
        return list(await self.session.scalars(query))

    async def get_requirement(
        self, requirement_id: int
    ) -> BookingDocumentRequirement | None:
        return await self.session.get(BookingDocumentRequirement, requirement_id)

    async def create_requirement(
        self, payload: DocumentRequirementWrite
    ) -> BookingDocumentRequirement:
        item = BookingDocumentRequirement(**payload.model_dump())
        self.session.add(item)
        await self.session.flush()
        return item

    async def update_requirement(
        self,
        item: BookingDocumentRequirement,
        payload: DocumentRequirementWrite,
    ) -> BookingDocumentRequirement:
        for key, value in payload.model_dump().items():
            setattr(item, key, value)
        await self.session.flush()
        return item

    async def add_document(
        self,
        *,
        booking_id: int,
        customer_id: int,
        requirement_id: int | None,
        passenger_index: int | None,
        original_name: str,
        storage_key: str,
        mime_type: str,
        byte_size: int,
    ) -> BookingDocument:
        document = BookingDocument(
            booking_id=booking_id,
            customer_id=customer_id,
            requirement_id=requirement_id,
            passenger_index=passenger_index,
            original_name=original_name,
            storage_key=storage_key,
            mime_type=mime_type,
            byte_size=byte_size,
        )
        self.session.add(document)
        await self.session.flush()
        return document

    async def list_customer_documents(
        self, customer_id: int, booking_id: int
    ) -> list[BookingDocument]:
        return list(
            await self.session.scalars(
                select(BookingDocument)
                .where(
                    BookingDocument.customer_id == customer_id,
                    BookingDocument.booking_id == booking_id,
                )
                .order_by(BookingDocument.created_at, BookingDocument.id)
            )
        )

    async def get_customer_document(
        self, customer_id: int, document_id: int
    ) -> BookingDocument | None:
        return await self.session.scalar(
            select(BookingDocument).where(
                BookingDocument.id == document_id,
                BookingDocument.customer_id == customer_id,
            )
        )

    async def list_admin_documents(
        self, booking_id: int | None = None
    ) -> list[BookingDocument]:
        query = select(BookingDocument)
        if booking_id is not None:
            query = query.where(BookingDocument.booking_id == booking_id)
        return list(
            await self.session.scalars(
                query.order_by(BookingDocument.created_at.desc()).limit(300)
            )
        )

    async def get_document(self, document_id: int) -> BookingDocument | None:
        return await self.session.get(BookingDocument, document_id)

    async def apply_installment_plan(
        self,
        booking: BookingRequest,
        quote: InstallmentQuote,
    ) -> None:
        booking.payment_method = "installment"
        booking.payable_now_amount = quote.down_payment
        booking.installment_months = quote.months
        booking.installment_down_payment = quote.down_payment
        booking.installment_fee_rate = (
            quote.fee_amount / quote.financed_amount / quote.months * Decimal(100)
        )
        booking.installment_financed_amount = quote.financed_amount
        booking.installment_total_amount = quote.installment_total
        booking.installment_monthly_amount = quote.monthly_amount
        booking.installment_first_due_date = quote.first_due_date
        booking.installment_status = "pending_review"
        for line in quote.schedule:
            self.session.add(
                BookingInstallment(
                    booking_id=booking.id,
                    sequence=line.sequence,
                    due_date=line.due_date,
                    amount=line.amount,
                    status=line.status,
                )
            )
        await self.session.flush()

    async def list_installments(self, booking_id: int) -> list[BookingInstallment]:
        return list(
            await self.session.scalars(
                select(BookingInstallment)
                .where(BookingInstallment.booking_id == booking_id)
                .order_by(BookingInstallment.sequence)
            )
        )

    async def get_installment(self, installment_id: int) -> BookingInstallment | None:
        return await self.session.get(BookingInstallment, installment_id)

    def add_event(
        self,
        *,
        booking_id: int,
        actor_type: str,
        actor_id: int | None,
        event_type: str,
        from_status: str | None = None,
        to_status: str | None = None,
        note: str | None = None,
        payload: dict[str, object] | None = None,
    ) -> None:
        self.session.add(
            BookingStatusEvent(
                booking_id=booking_id,
                actor_type=actor_type,
                actor_id=actor_id,
                event_type=event_type,
                from_status=from_status,
                to_status=to_status,
                note=note,
                payload=payload or {},
            )
        )

    @staticmethod
    def review_document(
        document: BookingDocument,
        *,
        admin_id: int,
        status: str,
        note: str | None,
    ) -> None:
        document.status = status
        document.review_note = note
        document.reviewed_by_admin_id = admin_id
        document.reviewed_at = datetime.now(UTC)
