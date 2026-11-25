from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import PublicationStatus, TravelService, TravelServiceImage
from app.repositories.avina_hotels import register_image
from app.services.avina_hotel_media import PreparedImage

if TYPE_CHECKING:
    from app.api.routes.erp_visas import VisaProfile


NATIVE_VISA_TYPES = {
    "tourist": "tourist",
    "توریستی": "tourist",
    "گردشگری": "tourist",
    "business": "business",
    "تجاری": "business",
    "exhibition": "exhibition",
    "نمایشگاهی": "exhibition",
    "residency": "residency",
    "اقامتی": "residency",
    "student": "student",
    "تحصیلی": "student",
}


async def publish_visa_profile(
    session: AsyncSession,
    profile: "VisaProfile",
    images: tuple[PreparedImage | None, list[PreparedImage]] | None,
) -> str:
    async with session.begin():
        await session.execute(
            select(
                func.pg_advisory_xact_lock(
                    func.hashtextextended(f"avina-visa:{profile.id}", 0)
                )
            )
        )
        item = await session.scalar(
            select(TravelService)
            .where(TravelService.avina_visa_service_id == profile.id)
            .with_for_update()
        )
        if item is None:
            item = TravelService(
                slug=f"visa-{profile.id.hex}",
                avina_visa_service_id=profile.id,
            )
            session.add(item)

        description = profile.description or ""
        item.service_type = "visa"
        item.title = profile.name
        item.country = profile.countryName
        item.summary = description[:300]
        item.description = description
        item.visa_type = NATIVE_VISA_TYPES.get(profile.visaType.casefold())
        item.display_order = profile.displayOrder
        item.avina_visa_profile = {
            "code": profile.code,
            "english_name": profile.englishName,
            "country_code": profile.countryCode,
            "visa_type": profile.visaType,
            "reference_validity_days": profile.referenceValidityDays,
            "reference_validity_mode": profile.referenceValidityMode,
            "required_documents": list(dict.fromkeys(profile.requiredDocuments)),
        }
        item.status = (
            PublicationStatus.PUBLISHED if profile.active else PublicationStatus.DRAFT
        )
        item.published_at = (
            (item.published_at or datetime.now(UTC)) if profile.active else None
        )

        if images is None:
            return item.slug

        main, gallery = images
        all_images = ([main] if main else []) + gallery
        by_key = {image.key: image for image in all_images}
        image_ids = {
            key: await register_image(session, by_key[key], profile.name)
            for key in sorted(by_key)
        }
        item.image_id = image_ids[main.key] if main else None
        gallery_ids = list(dict.fromkeys(image_ids[image.key] for image in gallery))
        await session.flush()
        await session.refresh(item, ["gallery"])
        if item.gallery_image_ids != gallery_ids:
            item.gallery.clear()
            await session.flush()
            item.gallery.extend(
                TravelServiceImage(image_id=image_id, display_order=index)
                for index, image_id in enumerate(gallery_ids)
            )
        return item.slug
