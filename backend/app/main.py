"""FastAPI application entry point."""

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from uuid import uuid4

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.api.router import router
from app.core.config import get_settings
from app.core.rate_limit import (
    RateLimiterUnavailable,
    SlidingWindowRateLimiter,
    resolve_client_address,
)
from app.db.session import engine, session_factory
from app.repositories.bookings import BookingRepository

settings = get_settings()
logger = logging.getLogger(__name__)
rate_limiter = SlidingWindowRateLimiter(
    redis_url=(
        settings.REDIS_URL.get_secret_value()
        if settings.REDIS_URL is not None
        else None
    ),
    production=settings.APP_ENV in {"staging", "production"},
)
request_id_pattern = re.compile(r"^[A-Za-z0-9._-]{8,128}$")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        send_default_pii=False,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    )


async def sweep_expired_bookings() -> None:
    """Release expired reservations even when no user opens booking pages."""
    while True:
        try:
            async with session_factory() as session:
                await BookingRepository(session).expire_overdue_invoices()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("booking expiry sweep failed")
        await asyncio.sleep(settings.BOOKING_EXPIRY_SWEEP_SECONDS)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Manage process-wide resources."""
    expiry_task = asyncio.create_task(
        sweep_expired_bookings(), name="booking-expiry-sweep"
    )
    try:
        yield
    finally:
        expiry_task.cancel()
        with suppress(asyncio.CancelledError):
            await expiry_task
        await rate_limiter.close()
        await engine.dispose()


def create_application() -> FastAPI:
    """Create the configured FastAPI application."""
    application = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Versioned REST API for the Jahan Bastan website, administrative "
            "content management, and company CRM integration."
        ),
        debug=settings.APP_DEBUG,
        version="0.1.0",
        contact={"name": "Jahan Bastan engineering"},
        servers=[
            {
                "url": "/",
                "description": "Current origin; TLS is terminated by deployment.",
            }
        ],
        lifespan=lifespan,
        docs_url=None if settings.APP_ENV in {"staging", "production"} else "/docs",
        redoc_url=None if settings.APP_ENV in {"staging", "production"} else "/redoc",
        openapi_url=(
            None if settings.APP_ENV in {"staging", "production"} else "/openapi.json"
        ),
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
            "X-Requested-With",
        ],
    )
    application.include_router(router)

    @application.middleware("http")
    async def limit_abuse_prone_requests(
        request: Request,
        call_next,
    ) -> Response:
        """Apply distributed limits to public authentication flows."""
        if settings.SECURITY_RATE_LIMIT_ENABLED and request.method == "POST":
            direct_address = request.client.host if request.client else "unknown"
            client_address = resolve_client_address(
                direct_address,
                request.headers.get("x-forwarded-for"),
                settings.TRUSTED_PROXY_CIDRS,
            )
            try:
                retry_after = await rate_limiter.check(client_address, request.url.path)
            except RateLimiterUnavailable:
                return JSONResponse(
                    status_code=503,
                    content={"detail": "security service temporarily unavailable"},
                    headers={"Cache-Control": "no-store", "Retry-After": "5"},
                )
            if retry_after is not None:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "too many requests; please try again later"},
                    headers={
                        "Retry-After": str(retry_after),
                        "Cache-Control": "no-store",
                    },
                )
        return await call_next(request)

    @application.middleware("http")
    async def prevent_sensitive_response_caching(
        request: Request,
        call_next,
    ) -> Response:
        """Prevent browsers and intermediaries from caching admin responses."""
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
            )
        if settings.APP_ENV in {"staging", "production"}:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        if request.url.path.startswith(
            (
                "/api/v1/auth",
                "/api/v1/account",
                "/api/v1/admin",
                "/api/v1/admin-users",
                "/api/v1/payments",
                "/api/v1/support",
                "/api/v1/integration/nora",
            )
        ):
            response.headers["Cache-Control"] = "no-store"
        return response

    @application.middleware("http")
    async def add_request_observability(
        request: Request,
        call_next,
    ) -> Response:
        """Attach a safe correlation ID and log request outcomes without PII."""
        incoming_request_id = request.headers.get("X-Request-ID", "").strip()
        request_id = (
            incoming_request_id
            if request_id_pattern.fullmatch(incoming_request_id)
            else uuid4().hex
        )
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            raise

        response.headers["X-Request-ID"] = request_id
        if not request.url.path.startswith("/health/"):
            logger.info(
                "request complete",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 1),
                },
            )
        return response

    def custom_openapi() -> dict:
        """Document cookie security and standard error contracts."""
        if application.openapi_schema:
            return application.openapi_schema
        schema = get_openapi(
            title=application.title,
            version=application.version,
            description=application.description,
            routes=application.routes,
        )
        schema["info"]["contact"] = application.contact
        schema["servers"] = application.servers
        components = schema.setdefault("components", {})
        components.setdefault("securitySchemes", {})["CustomerSessionCookie"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.CUSTOMER_SESSION_COOKIE_NAME,
            "description": "Revocable HttpOnly public customer session cookie.",
        }
        components.setdefault("securitySchemes", {})["AdminSessionCookie"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.ADMIN_SESSION_COOKIE_NAME,
            "description": "Revocable HttpOnly administrator session cookie.",
        }
        components.setdefault("schemas", {})["ErrorResponse"] = {
            "type": "object",
            "required": ["detail"],
            "properties": {
                "detail": {
                    "type": "string",
                    "description": "Safe, actionable error summary.",
                }
            },
        }
        protected_prefixes = (
            "/api/v1/auth/me",
            "/api/v1/auth/logout",
            "/api/v1/admin",
            "/api/v1/admin-users",
        )
        for path, path_item in schema["paths"].items():
            for method, operation in path_item.items():
                if method not in {"get", "post", "patch", "delete", "put"}:
                    continue
                if path.startswith(protected_prefixes):
                    operation["security"] = [{"AdminSessionCookie": []}]
                elif path.startswith("/api/v1/account/"):
                    operation["security"] = (
                        []
                        if path.endswith(
                            (
                                "/login",
                                "/register",
                                "/password-reset/request",
                                "/password-reset/confirm",
                            )
                        )
                        else [{"CustomerSessionCookie": []}]
                    )
                elif path.startswith("/api/v1/payments/"):
                    operation["security"] = (
                        []
                        if path.endswith("/configuration")
                        else [{"CustomerSessionCookie": []}]
                    )
                elif path == "/api/v1/auth/login":
                    operation["security"] = []
                error_response = {
                    "description": "The request could not be completed.",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                        }
                    },
                }
                operation.setdefault("responses", {}).setdefault("500", error_response)
                if method == "get":
                    success = operation["responses"].get("200")
                    if isinstance(success, dict):
                        success.setdefault("headers", {})["Cache-Control"] = {
                            "description": "Response caching policy.",
                            "schema": {"type": "string"},
                        }
        application.openapi_schema = schema
        return schema

    application.openapi = custom_openapi
    return application


app = create_application()
