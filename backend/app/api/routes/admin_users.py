"""Role-protected administrative user-management endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies.auth import (
    DatabaseSession,
    SuperAdmin,
    TrustedOrigin,
)
from app.core.security import hash_password
from app.repositories.admin_users import AdminUserRepository
from app.schemas.admin import (
    AdminUserCreate,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdate,
)

router = APIRouter(prefix="/admin-users", tags=["admin-users"])


@router.get("", response_model=AdminUserListResponse)
async def list_admin_users(
    session: DatabaseSession,
    _super_admin: SuperAdmin,
    limit: int = Query(default=25, ge=1, le=100, alias="pageSize"),
    offset: int = Query(default=0, ge=0),
) -> AdminUserListResponse:
    """List administrative accounts with bounded offset pagination."""
    users, total = await AdminUserRepository(session).list(limit=limit, offset=offset)
    return AdminUserListResponse(
        items=users,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_user(
    payload: AdminUserCreate,
    session: DatabaseSession,
    _super_admin: SuperAdmin,
    _trusted_origin: TrustedOrigin,
) -> AdminUserResponse:
    """Create an administrative account with an Argon2 password hash."""
    repository = AdminUserRepository(session)
    if await repository.get_by_email(str(payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        )
    try:
        user = await repository.create(
            email=str(payload.email),
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        ) from exc
    await session.refresh(user)
    return AdminUserResponse.model_validate(user)


@router.get("/{userId}", response_model=AdminUserResponse)
async def get_admin_user(
    user_id: Annotated[int, Path(alias="userId", ge=1)],
    session: DatabaseSession,
    _super_admin: SuperAdmin,
) -> AdminUserResponse:
    """Return one administrative account."""
    user = await AdminUserRepository(session).get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="administrator not found",
        )
    return AdminUserResponse.model_validate(user)


@router.patch("/{userId}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: Annotated[int, Path(alias="userId", ge=1)],
    payload: AdminUserUpdate,
    session: DatabaseSession,
    current_admin: SuperAdmin,
    _trusted_origin: TrustedOrigin,
) -> AdminUserResponse:
    """Update role, status, profile, or password for an administrator."""
    repository = AdminUserRepository(session)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="administrator not found",
        )

    removes_super_admin = user.role == "super_admin" and (
        payload.role not in (None, "super_admin") or payload.is_active is False
    )
    if removes_super_admin and await repository.count_active_super_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="the last active super administrator cannot be removed",
        )
    if user.id == current_admin.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you cannot deactivate your own account",
        )

    if payload.full_name is not None:
        user.full_name = " ".join(payload.full_name.split())
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.can_manage_pricing is not None:
        user.can_manage_pricing = payload.can_manage_pricing
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
        await repository.revoke_sessions(user.id)
    elif payload.is_active is False:
        await repository.revoke_sessions(user.id)

    await session.commit()
    await session.refresh(user)
    return AdminUserResponse.model_validate(user)


@router.delete("/{userId}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: Annotated[int, Path(alias="userId", ge=1)],
    session: DatabaseSession,
    current_admin: SuperAdmin,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Permanently delete an administrator, retaining operational history."""
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you cannot deactivate your own account",
        )
    repository = AdminUserRepository(session)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="administrator not found",
        )
    if (
        user.role == "super_admin"
        and user.is_active
        and await repository.count_active_super_admins() <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="the last active super administrator cannot be removed",
        )
    await repository.delete(user.id)
    await session.commit()
