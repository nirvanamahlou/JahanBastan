"""Read-only aggregation of administrative activity and login histories."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminSession, AdminUser, CartEvent, LeadActivity
from app.models.checkout import BookingStatusEvent


class AdminAuditRepository:
    """Return a privacy-minimised activity feed without N+1 queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_login_events(
        self, *, limit: int, idle_minutes: int
    ) -> list[dict[str, Any]]:
        """Return recent successful administrator logins in one bounded query."""
        rows = await self.session.execute(
            select(
                AdminSession,
                AdminUser.full_name,
                AdminUser.email,
                AdminUser.role,
            )
            .outerjoin(AdminUser, AdminSession.admin_user_id == AdminUser.id)
            .order_by(AdminSession.created_at.desc(), AdminSession.id.desc())
            .limit(limit)
        )
        now = datetime.now(UTC)
        idle_cutoff = now - timedelta(minutes=idle_minutes)
        return [
            self._login_event(
                login_session,
                actor_name or "کاربر حذف‌شده",
                email or "—",
                role or "deleted",
                now=now,
                idle_cutoff=idle_cutoff,
            )
            for login_session, actor_name, email, role in rows.all()
        ]

    async def list_events(self, *, limit: int) -> list[dict[str, Any]]:
        """Merge the newest cart, booking, and lead events."""
        cart_rows = await self.session.execute(
            select(CartEvent, AdminUser.full_name)
            .outerjoin(AdminUser, CartEvent.actor_id == AdminUser.id)
            .order_by(CartEvent.created_at.desc(), CartEvent.id.desc())
            .limit(limit)
        )
        booking_rows = await self.session.execute(
            select(BookingStatusEvent, AdminUser.full_name)
            .outerjoin(AdminUser, BookingStatusEvent.actor_id == AdminUser.id)
            .order_by(
                BookingStatusEvent.created_at.desc(),
                BookingStatusEvent.id.desc(),
            )
            .limit(limit)
        )
        lead_rows = await self.session.execute(
            select(LeadActivity, AdminUser.full_name)
            .outerjoin(AdminUser, LeadActivity.admin_id == AdminUser.id)
            .order_by(LeadActivity.created_at.desc(), LeadActivity.id.desc())
            .limit(limit)
        )
        events = [
            *(self._cart_event(event, actor) for event, actor in cart_rows.all()),
            *(self._booking_event(event, actor) for event, actor in booking_rows.all()),
            *(self._lead_event(event, actor) for event, actor in lead_rows.all()),
        ]
        events.sort(key=lambda event: (event["occurred_at"], event["id"]), reverse=True)
        return events[:limit]

    @staticmethod
    def _actor_name(actor_name: str | None, actor_type: str) -> str:
        if actor_name:
            return actor_name
        if actor_type == "system":
            return "سیستم"
        if actor_type == "customer":
            return "مشتری"
        return "کاربر حذف‌شده"

    @staticmethod
    def _login_event(
        login_session: AdminSession,
        actor_name: str,
        email: str,
        role: str,
        *,
        now: datetime,
        idle_cutoff: datetime,
    ) -> dict[str, Any]:
        last_seen_at = login_session.last_seen_at or login_session.created_at
        if login_session.revoked_at is not None:
            session_status = "revoked"
        elif login_session.expires_at <= now or last_seen_at <= idle_cutoff:
            session_status = "expired"
        else:
            session_status = "active"
        return {
            "id": login_session.id,
            "admin_user_id": login_session.admin_user_id,
            "actor_name": actor_name,
            "email": email,
            "role": role,
            "status": session_status,
            "logged_in_at": login_session.created_at,
            "last_seen_at": login_session.last_seen_at,
            "expires_at": login_session.expires_at,
            "revoked_at": login_session.revoked_at,
        }

    @classmethod
    def _cart_event(cls, event: CartEvent, actor: str | None) -> dict[str, Any]:
        labels = {
            "cart_created": "سبد خرید ایجاد شد",
            "cart_abandoned": "سبد رهاشده ثبت شد",
            "cart_cancelled": "سبد لغو شد",
            "cart_archived_from_admin_list": "سبد بایگانی شد",
            "cart_hold_extended": "زمان نگه‌داری موقت تمدید شد",
            "cart_reminder_sent": "یادآوری تکمیل خرید ارسال شد",
            "payment_link_resent": "لینک پرداخت دوباره ارسال شد",
            "follow_up_logged": "یادداشت پیگیری ثبت شد",
            "consultation_requested": "درخواست مشاوره ثبت شد",
        }
        return {
            "id": event.id,
            "source": "cart",
            "entity_type": "cart",
            "entity_id": event.cart_id,
            "actor_name": cls._actor_name(actor, event.actor_type),
            "action": labels.get(event.event_type, "وضعیت سبد به‌روزرسانی شد"),
            "from_status": None,
            "to_status": None,
            "occurred_at": event.created_at,
        }

    @classmethod
    def _booking_event(
        cls, event: BookingStatusEvent, actor: str | None
    ) -> dict[str, Any]:
        labels = {
            "booking_approved": "درخواست رزرو تأیید شد",
            "booking_rejected": "درخواست رزرو رد شد",
            "payment_confirmed_by_admin": "پرداخت توسط کارشناس تأیید شد",
            "gateway_payment_verified": "پرداخت درگاه تأیید شد",
            "ticket_issuance_confirmed_by_admin": "صدور بلیت تأیید شد",
            "payment_failed_hold_released": "پرداخت ناموفق بود و ظرفیت آزاد شد",
        }
        return {
            "id": event.id,
            "source": "booking",
            "entity_type": "booking",
            "entity_id": event.booking_id,
            "actor_name": cls._actor_name(actor, event.actor_type),
            "action": labels.get(event.event_type, "وضعیت رزرو به‌روزرسانی شد"),
            "from_status": event.from_status,
            "to_status": event.to_status,
            "occurred_at": event.created_at,
        }

    @classmethod
    def _lead_event(cls, event: LeadActivity, actor: str | None) -> dict[str, Any]:
        labels = {
            "created": "سرنخ فروش ایجاد شد",
            "status_changed": "وضعیت سرنخ فروش تغییر کرد",
            "note": "یادداشت سرنخ فروش ثبت شد",
            "follow_up": "پیگیری سرنخ فروش ثبت شد",
        }
        return {
            "id": event.id,
            "source": "lead",
            "entity_type": "lead",
            "entity_id": event.lead_id,
            "actor_name": actor or "کاربر حذف‌شده",
            "action": labels.get(event.activity_type, "سرنخ فروش به‌روزرسانی شد"),
            "from_status": None,
            "to_status": None,
            "occurred_at": event.created_at,
        }
