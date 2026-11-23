"""Persistence operations for public and administrative support chat."""

from datetime import UTC, datetime
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.security import hash_session_token
from app.models import CustomerSupportRequest, SupportMessage

QUICK_REPLIES: dict[str, tuple[str, str]] = {
    "tour_booking": (
        "رزرو تور چگونه انجام می‌شود؟",
        (
            "برای رزرو تور، تاریخ برگزاری و سپس هتل پکیج را انتخاب کنید و "
            "تور را به سبد خرید بفرستید. پس از صدور پیش‌فاکتور و تأیید "
            "پشتیبان، امکان پرداخت فعال می‌شود."
        ),
    ),
    "booking_status": (
        "چطور وضعیت رزرو را پیگیری کنم؟",
        (
            "پس از ورود به پنل کاربری، بخش رزروها و پیش‌فاکتورها آخرین "
            "وضعیت درخواست شما را نشان می‌دهد. پشتیبان نیز می‌تواند همین‌جا "
            "راهنمایی‌تان کند."
        ),
    ),
    "visa_services": (
        "برای خدمات ویزا چه مدارکی لازم است؟",
        (
            "مدارک با توجه به کشور و نوع ویزا متفاوت است. از صفحه خدمات ویزا "
            "کشور و نوع ویزا را انتخاب کنید؛ برای بررسی دقیق‌تر، مقصد و زمان "
            "سفر را برای پشتیبان بنویسید."
        ),
    ),
    "talk_to_support": (
        "می‌خواهم با پشتیبان صحبت کنم",
        (
            "پیام شما برای تیم پشتیبانی ثبت شد. لطفاً سوالتان را بنویسید؛ "
            "پاسخ پشتیبان در همین پنجره نمایش داده می‌شود."
        ),
    ),
}


class SupportConversationRepository:
    """Bounded, eager-loaded support conversation queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _messages_loader():
        return selectinload(CustomerSupportRequest.messages)

    async def create_guest_conversation(
        self,
        *,
        message: str,
        subject: str | None,
        visitor_name: str | None,
        visitor_email: str | None,
        quick_reply_key: str | None,
    ) -> tuple[CustomerSupportRequest, str]:
        access_token = token_urlsafe(32)
        quick_question, automated_answer = QUICK_REPLIES.get(
            quick_reply_key or "", (message, "")
        )
        initial_message = quick_question if quick_reply_key else message
        conversation = CustomerSupportRequest(
            customer_id=None,
            guest_token_hash=hash_session_token(access_token),
            visitor_name=visitor_name,
            visitor_email=visitor_email,
            source="chatbot",
            subject=subject or "گفتگو با پشتیبانی",
            message=initial_message,
            status="open",
            last_sender="bot" if automated_answer else "customer",
        )
        conversation.messages = [
            SupportMessage(sender_type="customer", body=initial_message)
        ]
        if automated_answer:
            conversation.messages.append(
                SupportMessage(sender_type="bot", body=automated_answer)
            )
        self.session.add(conversation)
        await self.session.flush()
        return conversation, access_token

    async def get_guest_conversation(
        self, conversation_id: int, access_token: str
    ) -> CustomerSupportRequest | None:
        return await self.session.scalar(
            select(CustomerSupportRequest)
            .options(
                self._messages_loader(),
                joinedload(CustomerSupportRequest.customer),
            )
            .where(
                CustomerSupportRequest.id == conversation_id,
                CustomerSupportRequest.guest_token_hash
                == hash_session_token(access_token),
                CustomerSupportRequest.source == "chatbot",
            )
        )

    async def add_guest_message(
        self,
        conversation: CustomerSupportRequest,
        *,
        message: str,
        quick_reply_key: str | None,
    ) -> None:
        quick_question, automated_answer = QUICK_REPLIES.get(
            quick_reply_key or "", (message, "")
        )
        body = quick_question if quick_reply_key else message
        conversation.messages.append(SupportMessage(sender_type="customer", body=body))
        if automated_answer:
            conversation.messages.append(
                SupportMessage(sender_type="bot", body=automated_answer)
            )
            conversation.last_sender = "bot"
        else:
            conversation.last_sender = "customer"
        conversation.status = "open"
        conversation.updated_at = datetime.now(UTC)
        await self.session.flush()

    async def list_for_admin(
        self, *, status: str | None, limit: int = 100
    ) -> list[CustomerSupportRequest]:
        statement = (
            select(CustomerSupportRequest)
            .options(
                self._messages_loader(),
                joinedload(CustomerSupportRequest.customer),
            )
            .order_by(
                CustomerSupportRequest.updated_at.desc(),
                CustomerSupportRequest.id.desc(),
            )
            .limit(limit)
        )
        if status:
            statement = statement.where(CustomerSupportRequest.status == status)
        return list((await self.session.scalars(statement)).unique().all())

    async def get_for_admin(
        self, conversation_id: int
    ) -> CustomerSupportRequest | None:
        return await self.session.scalar(
            select(CustomerSupportRequest)
            .options(
                self._messages_loader(),
                joinedload(CustomerSupportRequest.customer),
            )
            .where(CustomerSupportRequest.id == conversation_id)
        )

    async def add_admin_reply(
        self,
        conversation: CustomerSupportRequest,
        *,
        admin_id: int,
        message: str,
    ) -> None:
        conversation.messages.append(
            SupportMessage(sender_type="admin", admin_id=admin_id, body=message)
        )
        conversation.status = "in_progress"
        conversation.last_sender = "admin"
        conversation.updated_at = datetime.now(UTC)
        await self.session.flush()

    async def update_status(
        self, conversation: CustomerSupportRequest, status: str
    ) -> None:
        conversation.status = status
        conversation.updated_at = datetime.now(UTC)
        await self.session.flush()

    async def delete(self, conversation: CustomerSupportRequest) -> None:
        """Permanently remove a conversation and its cascade-owned messages."""
        await self.session.delete(conversation)
        await self.session.flush()
