"""Administrative authentication endpoints."""

from datetime import UTC, datetime, timedelta
from secrets import randbelow
from smtplib import SMTPException

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.dependencies.auth import (
    CurrentAdmin,
    DatabaseSession,
    TrustedOrigin,
)
from app.core.config import get_settings
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.repositories.admin_mfa import AdminMfaRepository
from app.repositories.admin_users import (
    AdminPasswordResetCodeRepository,
    AdminSessionRepository,
    AdminUserRepository,
)
from app.schemas.admin import (
    AdminMfaCodeRequest,
    AdminMfaDisableRequest,
    AdminMfaSetupResponse,
    AdminMfaStatus,
    AdminPasswordChangeRequest,
    AdminPasswordResetConfirm,
    AdminPasswordResetRequest,
    AuthenticationResponse,
    LoginRequest,
)
from app.services.admin_mfa import (
    decrypt_secret,
    encrypt_secret,
    generate_secret,
    provisioning_uri,
    verify_code,
)
from app.services.password_reset_email import (
    deliver_admin_password_reset_code_email,
    smtp_is_configured,
)

router = APIRouter(prefix="/auth", tags=["admin-authentication"])
settings = get_settings()


@router.post(
    "/login",
    response_model=AuthenticationResponse,
    status_code=status.HTTP_200_OK,
)
async def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> AuthenticationResponse:
    """Authenticate an administrator and issue a revocable HttpOnly session."""
    repository = AdminUserRepository(session)
    user = await repository.get_by_email(str(payload.email))
    password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    password_valid = verify_password(payload.password, password_hash)
    now = datetime.now(UTC)

    if user is not None and user.locked_until and user.locked_until > now:
        retry_after = max(1, int((user.locked_until - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="login temporarily locked",
            headers={"Retry-After": str(retry_after)},
        )

    if user is None or not password_valid or not user.is_active:
        if user is not None:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.ADMIN_LOGIN_MAX_ATTEMPTS:
                user.locked_until = now + timedelta(
                    minutes=settings.ADMIN_LOCKOUT_MINUTES
                )
                user.failed_login_count = 0
            await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid email or password",
        )

    mfa_credential = await AdminMfaRepository(session).get_for_admin(user.id)
    if settings.ADMIN_MFA_REQUIRED and not (
        mfa_credential is not None and mfa_credential.is_enabled
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="multi-factor authentication enrollment is required",
        )
    if mfa_credential is not None and mfa_credential.is_enabled:
        try:
            mfa_valid = bool(payload.mfa_code) and verify_code(
                decrypt_secret(mfa_credential.secret_ciphertext, settings),
                payload.mfa_code or "",
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="administrator MFA is unavailable",
            ) from None
        if not mfa_valid:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.ADMIN_LOGIN_MAX_ATTEMPTS:
                user.locked_until = now + timedelta(
                    minutes=settings.ADMIN_LOCKOUT_MINUTES
                )
                user.failed_login_count = 0
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="multi-factor authentication code required or invalid",
            )

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    raw_token = generate_session_token()
    expires_at = now + timedelta(minutes=settings.ADMIN_SESSION_TTL_MINUTES)
    await AdminSessionRepository(session).create(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=expires_at,
    )
    await session.commit()
    await session.refresh(user)

    response.set_cookie(
        key=settings.ADMIN_SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=settings.ADMIN_SESSION_TTL_MINUTES * 60,
        expires=expires_at,
        httponly=True,
        secure=settings.APP_ENV in {"staging", "production"},
        samesite="strict",
        path="/",
    )
    return AuthenticationResponse(user=user)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    payload: AdminPasswordResetRequest,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> dict[str, str]:
    """Email a recovery code without revealing whether an account exists."""
    if not smtp_is_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="administrator password recovery email is not configured",
        )

    generic_response = {
        "message": (
            "If the email belongs to an active administrator, a recovery code "
            "has been sent."
        )
    }
    users = AdminUserRepository(session)
    user = await users.get_by_email(str(payload.email))
    if user is None or not user.is_active or user.password_hash.startswith("!nora-"):
        return generic_response

    now = datetime.now(UTC)
    raw_code = f"{randbelow(1_000_000):06d}"
    reset_codes = AdminPasswordResetCodeRepository(session)
    await reset_codes.invalidate_active_for_admin(user.id)
    created_code = await reset_codes.create(
        admin_user_id=user.id,
        code_hash=hash_password(raw_code),
        expires_at=now + timedelta(minutes=settings.ADMIN_PASSWORD_RESET_TTL_MINUTES),
    )
    # Persist the code before the network call; email delivery never holds a
    # database transaction open. A failed delivery invalidates only this code.
    await session.commit()
    try:
        await deliver_admin_password_reset_code_email(
            settings=settings,
            recipient=user.email,
            code=raw_code,
        )
    except (OSError, SMTPException):
        await reset_codes.invalidate(created_code.id)
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="administrator password recovery email is temporarily unavailable",
        ) from None

    return generic_response


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(
    payload: AdminPasswordResetConfirm,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Verify a code, update the password, and revoke every active admin session."""
    users = AdminUserRepository(session)
    user = await users.get_by_email(str(payload.email))
    reset_codes = AdminPasswordResetCodeRepository(session)
    reset_code = (
        await reset_codes.get_active(user.id)
        if user is not None and user.is_active
        else None
    )
    code_hash = reset_code.code_hash if reset_code is not None else DUMMY_PASSWORD_HASH
    code_valid = verify_password(payload.code, code_hash)

    if user is None or not user.is_active or reset_code is None or not code_valid:
        if reset_code is not None:
            await reset_codes.register_failed_attempt(
                reset_code,
                max_attempts=settings.ADMIN_PASSWORD_RESET_MAX_ATTEMPTS,
            )
            await session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid or expired recovery code",
        )

    user.password_hash = hash_password(payload.password)
    user.failed_login_count = 0
    user.locked_until = None
    await reset_codes.consume(reset_code)
    await users.revoke_sessions(user.id)
    await session.commit()
    response.delete_cookie(
        key=settings.ADMIN_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="strict",
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: AdminPasswordChangeRequest,
    response: Response,
    current_admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Change the current administrator password without an external recovery flow."""
    if str(payload.email).lower() != current_admin.email.lower() or not verify_password(
        payload.current_password, current_admin.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid current credentials",
        )

    current_admin.password_hash = hash_password(payload.new_password)
    current_admin.failed_login_count = 0
    current_admin.locked_until = None
    await AdminUserRepository(session).revoke_sessions(current_admin.id)
    await session.commit()
    response.delete_cookie(
        key=settings.ADMIN_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="strict",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    """Revoke the current session and remove its browser cookie."""
    token = request.cookies.get(settings.ADMIN_SESSION_COOKIE_NAME)
    if token:
        await AdminSessionRepository(session).revoke(hash_session_token(token))
        await session.commit()
    response.delete_cookie(
        settings.ADMIN_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="strict",
    )


@router.get("/mfa", response_model=AdminMfaStatus)
async def get_mfa_status(
    current_admin: CurrentAdmin,
    session: DatabaseSession,
) -> AdminMfaStatus:
    credential = await AdminMfaRepository(session).get_for_admin(current_admin.id)
    return AdminMfaStatus(
        enabled=bool(credential and credential.is_enabled),
        required=settings.ADMIN_MFA_REQUIRED,
    )


@router.post("/mfa/setup", response_model=AdminMfaSetupResponse)
async def setup_mfa(
    current_admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> AdminMfaSetupResponse:
    secret = generate_secret()
    try:
        ciphertext = encrypt_secret(secret, settings)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="administrator MFA is not configured",
        ) from None
    await AdminMfaRepository(session).store_pending(
        admin_user_id=current_admin.id,
        secret_ciphertext=ciphertext,
    )
    await session.commit()
    return AdminMfaSetupResponse(
        secret=secret,
        provisioning_uri=provisioning_uri(
            secret,
            email=current_admin.email,
            issuer=settings.ADMIN_MFA_ISSUER,
        ),
    )


@router.post("/mfa/enable", response_model=AdminMfaStatus)
async def enable_mfa(
    payload: AdminMfaCodeRequest,
    current_admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> AdminMfaStatus:
    repository = AdminMfaRepository(session)
    credential = await repository.get_for_admin(current_admin.id)
    try:
        valid = credential is not None and verify_code(
            decrypt_secret(credential.secret_ciphertext, settings), payload.code
        )
    except ValueError:
        valid = False
    if not valid or credential is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid MFA setup or code",
        )
    await repository.enable(credential)
    await session.commit()
    return AdminMfaStatus(enabled=True, required=settings.ADMIN_MFA_REQUIRED)


@router.post("/mfa/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_mfa(
    payload: AdminMfaDisableRequest,
    response: Response,
    current_admin: CurrentAdmin,
    session: DatabaseSession,
    _trusted_origin: TrustedOrigin,
) -> None:
    repository = AdminMfaRepository(session)
    credential = await repository.get_for_admin(current_admin.id)
    try:
        valid_code = bool(credential and credential.is_enabled) and verify_code(
            decrypt_secret(credential.secret_ciphertext, settings), payload.code
        )
    except ValueError:
        valid_code = False
    if (
        not verify_password(payload.password, current_admin.password_hash)
        or not valid_code
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid password or MFA code",
        )
    await repository.delete_for_admin(current_admin.id)
    await AdminUserRepository(session).revoke_sessions(current_admin.id)
    await session.commit()
    response.delete_cookie(
        settings.ADMIN_SESSION_COOKIE_NAME,
        path="/",
        secure=settings.APP_ENV in {"staging", "production"},
        httponly=True,
        samesite="strict",
    )


@router.get("/me", response_model=AuthenticationResponse)
async def get_me(current_admin: CurrentAdmin) -> AuthenticationResponse:
    """Return the currently authenticated administrator."""
    return AuthenticationResponse(user=current_admin)
