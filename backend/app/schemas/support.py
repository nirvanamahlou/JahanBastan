"""Public and administrative support-chat contracts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

QuickReplyKey = Literal[
    "tour_booking",
    "booking_status",
    "visa_services",
    "talk_to_support",
]
SupportStatus = Literal["open", "in_progress", "closed"]
SenderType = Literal["customer", "bot", "admin"]


class SupportSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class PublicConversationCreate(SupportSchema):
    message: str = Field(min_length=2, max_length=4000)
    subject: str | None = Field(default=None, max_length=160)
    visitor_name: str | None = Field(default=None, max_length=120)
    visitor_email: EmailStr | None = None
    quick_reply_key: QuickReplyKey | None = None

    @field_validator("message", "subject", "visitor_name")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class PublicMessageCreate(SupportSchema):
    access_token: str = Field(min_length=32, max_length=128)
    message: str = Field(min_length=2, max_length=4000)
    quick_reply_key: QuickReplyKey | None = None

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        return value.strip()


class SupportMessageRead(SupportSchema):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    sender_type: SenderType
    body: str
    created_at: datetime


class SupportConversationRead(SupportSchema):
    id: int
    subject: str
    status: SupportStatus
    source: Literal["account", "chatbot"]
    visitor_name: str | None = None
    visitor_email: str | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    last_sender: SenderType
    created_at: datetime
    updated_at: datetime
    messages: list[SupportMessageRead]
    access_token: str | None = None


class AdminSupportReplyCreate(SupportSchema):
    message: str = Field(min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        return value.strip()


class AdminSupportStatusUpdate(SupportSchema):
    status: SupportStatus
