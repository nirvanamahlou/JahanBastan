"""Persistence access for private customer visa applications."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import TravelService, VisaApplication, VisaApplicationDocument
from app.models.content import PublicationStatus


class VisaApplicationRepository:
    """Query visa applications without lazy-loading customer documents."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self, *, customer_id: int, travel_service_id: int
    ) -> VisaApplication | None:
        service = await self.session.scalar(
            select(TravelService).where(
                TravelService.id == travel_service_id,
                TravelService.service_type == "visa",
                TravelService.status == PublicationStatus.PUBLISHED,
            )
        )
        if service is None:
            return None
        application = VisaApplication(
            customer_user_id=customer_id,
            travel_service_id=service.id,
            status="draft",
        )
        self.session.add(application)
        await self.session.flush()
        return application

    async def list_for_customer(self, customer_id: int) -> list[VisaApplication]:
        result = await self.session.scalars(
            select(VisaApplication)
            .where(VisaApplication.customer_user_id == customer_id)
            .options(
                joinedload(VisaApplication.travel_service),
                selectinload(VisaApplication.documents),
            )
            .order_by(VisaApplication.created_at.desc(), VisaApplication.id.desc())
        )
        return list(result.unique())

    async def get_for_customer(
        self, *, application_id: int, customer_id: int
    ) -> VisaApplication | None:
        return await self.session.scalar(
            select(VisaApplication)
            .where(
                VisaApplication.id == application_id,
                VisaApplication.customer_user_id == customer_id,
            )
            .options(
                joinedload(VisaApplication.travel_service),
                selectinload(VisaApplication.documents),
            )
        )

    async def get_document_for_customer(
        self, *, application_id: int, document_id: int, customer_id: int
    ) -> VisaApplicationDocument | None:
        return await self.session.scalar(
            select(VisaApplicationDocument)
            .join(VisaApplication)
            .where(
                VisaApplicationDocument.id == document_id,
                VisaApplicationDocument.visa_application_id == application_id,
                VisaApplication.customer_user_id == customer_id,
            )
        )

    async def list_for_admin(
        self, *, status: str | None, limit: int, offset: int
    ) -> tuple[list[VisaApplication], int]:
        filters = []
        if status:
            filters.append(VisaApplication.status == status)
        else:
            filters.append(VisaApplication.status != "draft")
        statement = (
            select(VisaApplication)
            .options(
                joinedload(VisaApplication.customer),
                joinedload(VisaApplication.travel_service),
                selectinload(VisaApplication.documents),
            )
            .order_by(VisaApplication.created_at.desc(), VisaApplication.id.desc())
            .limit(limit)
            .offset(offset)
        )
        count_statement = select(func.count(VisaApplication.id))
        if filters:
            statement = statement.where(*filters)
            count_statement = count_statement.where(*filters)
        applications = list((await self.session.scalars(statement)).unique())
        total = int(await self.session.scalar(count_statement) or 0)
        return applications, total

    async def get_for_admin(self, application_id: int) -> VisaApplication | None:
        return await self.session.scalar(
            select(VisaApplication)
            .where(
                VisaApplication.id == application_id,
                VisaApplication.status != "draft",
            )
            .options(
                joinedload(VisaApplication.customer),
                joinedload(VisaApplication.travel_service),
                selectinload(VisaApplication.documents),
            )
        )

    async def get_document_for_admin(
        self, *, application_id: int, document_id: int
    ) -> VisaApplicationDocument | None:
        return await self.session.scalar(
            select(VisaApplicationDocument).where(
                VisaApplicationDocument.id == document_id,
                VisaApplicationDocument.visa_application_id == application_id,
            )
        )
