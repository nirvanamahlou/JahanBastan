"""Administrative visibility and follow-up for recoverable customer carts."""

from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies.auth import CurrentAdmin, DatabaseSession, TrustedOrigin
from app.repositories.carts import CartLifecycleRepository
from app.schemas.account import (
    AdminCartRead,
    CartAdminFollowUp,
    CartAdminHoldExtension,
    CartAdminReminder,
)

router = APIRouter(prefix="/admin/carts", tags=["admin-carts"])
CartStatus = Literal["active", "abandoned", "converted", "expired", "cancelled"]


def require_cart_manager(admin: CurrentAdmin) -> None:
    if admin.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="cart manager role required")


@router.get("", response_model=list[AdminCartRead])
async def list_carts(
    admin: CurrentAdmin,
    session: DatabaseSession,
    cart_status: Annotated[CartStatus | None, Query(alias="status")] = None,
    query: Annotated[str | None, Query(min_length=1, max_length=160)] = None,
    item_type: Annotated[
        Literal["tour", "flight", "train", "bus"] | None,
        Query(alias="itemType"),
    ] = None,
    amount_from: Annotated[Decimal | None, Query(ge=0, alias="amountFrom")] = None,
    amount_to: Annotated[Decimal | None, Query(ge=0, alias="amountTo")] = None,
) -> list[AdminCartRead]:
    require_cart_manager(admin)
    if amount_from is not None and amount_to is not None and amount_from > amount_to:
        raise HTTPException(status_code=422, detail="amountFrom cannot exceed amountTo")
    rows = await CartLifecycleRepository(session).list_for_admin(
        cart_status,
        query=query,
        item_type=item_type,
        amount_from=amount_from,
        amount_to=amount_to,
    )
    await session.commit()
    return [AdminCartRead.model_validate(row) for row in rows]


@router.post("/{cart_id}/follow-up", status_code=status.HTTP_204_NO_CONTENT)
async def log_cart_follow_up(
    cart_id: int,
    payload: CartAdminFollowUp,
    admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    require_cart_manager(admin)
    cart = await CartLifecycleRepository(session).add_admin_follow_up(
        cart_id, admin.id, payload.note
    )
    if cart is None:
        raise HTTPException(status_code=404, detail="cart not found")
    await session.commit()


@router.post("/{cart_id}/extend-hold", status_code=status.HTTP_204_NO_CONTENT)
async def extend_cart_hold(
    cart_id: int,
    payload: CartAdminHoldExtension,
    admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    require_cart_manager(admin)
    try:
        cart = await CartLifecycleRepository(session).extend_admin_hold(
            cart_id, admin.id, payload.minutes
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if cart is None:
        raise HTTPException(status_code=404, detail="cart not found")
    await session.commit()


@router.post("/{cart_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_cart(
    cart_id: int,
    admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    require_cart_manager(admin)
    try:
        cart = await CartLifecycleRepository(session).cancel_admin_cart(
            cart_id, admin.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if cart is None:
        raise HTTPException(status_code=404, detail="cart not found")
    await session.commit()


@router.post("/{cart_id}/reminder", status_code=status.HTTP_204_NO_CONTENT)
async def send_cart_reminder(
    cart_id: int,
    payload: CartAdminReminder,
    admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    require_cart_manager(admin)
    cart = await CartLifecycleRepository(session).send_admin_reminder(
        cart_id, admin.id, payload.message
    )
    if cart is None:
        raise HTTPException(status_code=404, detail="cart not found")
    await session.commit()


@router.delete("/{cart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_cart_from_admin_list(
    cart_id: int,
    admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Hide a cart from the operations list without deleting commercial history."""
    require_cart_manager(admin)
    cart = await CartLifecycleRepository(session).archive_for_admin(cart_id, admin.id)
    if cart is None:
        raise HTTPException(status_code=404, detail="cart not found")
    await session.commit()
