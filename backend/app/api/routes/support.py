"""Guest chatbot and authenticated administrator support routes."""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.dependencies.auth import AdminManager, DatabaseSession, TrustedOrigin
from app.models import CustomerSupportRequest
from app.repositories.support import SupportConversationRepository
from app.schemas.support import (
    AdminSupportReplyCreate,
    AdminSupportStatusUpdate,
    PublicConversationCreate,
    PublicMessageCreate,
    SupportConversationRead,
    SupportMessageRead,
)

public_router = APIRouter(prefix="/support", tags=["support-chat"])
admin_router = APIRouter(prefix="/admin/support", tags=["admin-support"])


def _read_conversation(
    conversation: CustomerSupportRequest,
    *,
    access_token: str | None = None,
) -> SupportConversationRead:
    customer = conversation.customer if conversation.customer_id is not None else None
    return SupportConversationRead(
        id=conversation.id,
        subject=conversation.subject,
        status=conversation.status,
        source=conversation.source,
        visitor_name=conversation.visitor_name,
        visitor_email=conversation.visitor_email,
        customer_name=customer.full_name if customer else None,
        customer_email=customer.email if customer else None,
        last_sender=conversation.last_sender,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            SupportMessageRead.model_validate(message)
            for message in conversation.messages
        ],
        access_token=access_token,
    )


@public_router.post(
    "/conversations",
    response_model=SupportConversationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_conversation(
    payload: PublicConversationCreate,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> SupportConversationRead:
    conversation, access_token = await SupportConversationRepository(
        session
    ).create_guest_conversation(
        message=payload.message,
        subject=payload.subject,
        visitor_name=payload.visitor_name,
        visitor_email=str(payload.visitor_email) if payload.visitor_email else None,
        quick_reply_key=payload.quick_reply_key,
    )
    await session.commit()
    return _read_conversation(conversation, access_token=access_token)


@public_router.get(
    "/conversations/{conversation_id}", response_model=SupportConversationRead
)
async def get_public_conversation(
    conversation_id: int,
    session: DatabaseSession,
    token: str = Query(min_length=32, max_length=128),
) -> SupportConversationRead:
    conversation = await SupportConversationRepository(session).get_guest_conversation(
        conversation_id, token
    )
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    return _read_conversation(conversation)


@public_router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SupportConversationRead,
)
async def create_public_message(
    conversation_id: int,
    payload: PublicMessageCreate,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> SupportConversationRead:
    repository = SupportConversationRepository(session)
    conversation = await repository.get_guest_conversation(
        conversation_id, payload.access_token
    )
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    await repository.add_guest_message(
        conversation,
        message=payload.message,
        quick_reply_key=payload.quick_reply_key,
    )
    await session.commit()
    return _read_conversation(conversation)


@admin_router.get("/conversations", response_model=list[SupportConversationRead])
async def list_admin_conversations(
    _current_admin: AdminManager,
    session: DatabaseSession,
    conversation_status: str | None = Query(
        default=None, alias="status", pattern="^(open|in_progress|closed)$"
    ),
    limit: int = Query(default=100, ge=1, le=200),
) -> list[SupportConversationRead]:
    conversations = await SupportConversationRepository(session).list_for_admin(
        status=conversation_status, limit=limit
    )
    return [_read_conversation(item) for item in conversations]


@admin_router.get(
    "/conversations/{conversation_id}", response_model=SupportConversationRead
)
async def get_admin_conversation(
    conversation_id: int,
    _current_admin: AdminManager,
    session: DatabaseSession,
) -> SupportConversationRead:
    conversation = await SupportConversationRepository(session).get_for_admin(
        conversation_id
    )
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    return _read_conversation(conversation)


@admin_router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SupportConversationRead,
)
async def create_admin_message(
    conversation_id: int,
    payload: AdminSupportReplyCreate,
    current_admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> SupportConversationRead:
    repository = SupportConversationRepository(session)
    conversation = await repository.get_for_admin(conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    await repository.add_admin_reply(
        conversation, admin_id=current_admin.id, message=payload.message
    )
    await session.commit()
    return _read_conversation(conversation)


@admin_router.patch(
    "/conversations/{conversation_id}", response_model=SupportConversationRead
)
async def update_admin_conversation(
    conversation_id: int,
    payload: AdminSupportStatusUpdate,
    _current_admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> SupportConversationRead:
    repository = SupportConversationRepository(session)
    conversation = await repository.get_for_admin(conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    await repository.update_status(conversation, payload.status)
    await session.commit()
    return _read_conversation(conversation)


@admin_router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_admin_conversation(
    conversation_id: int,
    _current_admin: AdminManager,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> Response:
    repository = SupportConversationRepository(session)
    conversation = await repository.get_for_admin(conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    await repository.delete(conversation)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
