"""Validated application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.public_origin import public_origin

PROJECT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    """Typed settings shared by the API and background workers."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    APP_ENV: Literal["development", "test", "staging", "production"] = "development"
    APP_NAME: str = "Jahan Bastan API"
    APP_DEBUG: bool = False
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = Field(default=8000, ge=1, le=65535)
    SECURITY_RATE_LIMIT_ENABLED: bool = True
    REDIS_URL: SecretStr | None = None
    TRUSTED_PROXY_CIDRS: list[str] = ["127.0.0.0/8", "172.16.0.0/12"]
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    API_V1_PREFIX: str = "/api/v1"
    CORS_ALLOWED_ORIGINS: list[str] = []
    ADMIN_SESSION_COOKIE_NAME: str = "admin_session"
    ADMIN_SESSION_TTL_MINUTES: int = Field(default=120, ge=15, le=1440)
    ADMIN_SESSION_IDLE_MINUTES: int = Field(default=30, ge=5, le=240)
    ADMIN_MFA_ENCRYPTION_KEY: SecretStr | None = None
    ADMIN_MFA_ISSUER: str = "Jahan Bastan"
    ADMIN_MFA_REQUIRED: bool = False
    ADMIN_PASSWORD_RESET_TTL_MINUTES: int = Field(default=10, ge=5, le=60)
    ADMIN_PASSWORD_RESET_MAX_ATTEMPTS: int = Field(default=5, ge=3, le=10)
    ADMIN_LOGIN_MAX_ATTEMPTS: int = Field(default=5, ge=3, le=20)
    ADMIN_LOCKOUT_MINUTES: int = Field(default=15, ge=1, le=1440)
    CUSTOMER_SESSION_COOKIE_NAME: str = "customer_session"
    CUSTOMER_SESSION_TTL_MINUTES: int = Field(default=43_200, ge=15, le=525_600)
    CUSTOMER_SESSION_SHORT_TTL_MINUTES: int = Field(default=480, ge=15, le=43_200)
    CUSTOMER_LOGIN_MAX_ATTEMPTS: int = Field(default=5, ge=3, le=20)
    CUSTOMER_LOCKOUT_MINUTES: int = Field(default=15, ge=1, le=1440)
    PUBLIC_SITE_URL: str = "http://localhost:3000"
    NORA_CONNECTOR_ENCRYPTION_KEY: SecretStr | None = None
    NORA_PRESENCE_ENABLED: bool = False
    PASSWORD_RESET_TTL_MINUTES: int = Field(default=30, ge=5, le=1440)
    PASSWORD_RESET_EMAIL_ENABLED: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: SecretStr | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    # SMS delivery remains disabled until an approved provider adapter and
    # credentials are supplied; no one-time code is logged or exposed by the API.
    SMS_PROVIDER: Literal["disabled", "custom", "sms_ir"] = "disabled"
    # SMS.ir template delivery uses https://api.sms.ir/v1/send/verify.
    # Custom providers retain their separate request and provider-side verify URLs.
    SMS_REQUEST_URL: AnyHttpUrl | None = None
    SMS_VERIFY_URL: AnyHttpUrl | None = None
    SMS_API_KEY: SecretStr | None = None
    # Template tokens stay distinct so a provider panel can apply the correct
    # verification or reset message without leaking credentials into code.
    SMS_LOGIN_TEMPLATE_TOKEN: SecretStr | None = None
    SMS_FORGOT_PASSWORD_TEMPLATE_TOKEN: SecretStr | None = None
    SMS_TEMPLATE: str | None = None  # Legacy shared-template fallback.
    SMS_LOGIN_TEMPLATE_PARAMETER: str = "Code"
    SMS_TIMEOUT_SECONDS: float = Field(default=8, gt=0, le=30)
    SMS_OTP_TTL_SECONDS: int = Field(default=120, ge=60, le=900)
    SMS_OTP_MAX_ATTEMPTS: int = Field(default=5, ge=3, le=10)
    MEDIA_ROOT: str = "/app/media"
    MEDIA_MAX_BYTES: int = Field(default=5_242_880, ge=1024, le=20_971_520)
    MEDIA_MAX_DIMENSION: int = Field(default=2560, ge=512, le=8192)
    MEDIA_MAX_PIXELS: int = Field(default=40_000_000, ge=1_000_000, le=100_000_000)
    MEDIA_WEBP_QUALITY: int = Field(default=82, ge=50, le=95)
    PRIVATE_FILE_ENCRYPTION_KEY: SecretStr | None = None
    CLAMAV_HOST: str | None = None
    CLAMAV_PORT: int = Field(default=3310, ge=1, le=65535)
    CLAMAV_TIMEOUT_SECONDS: float = Field(default=10, gt=0, le=60)
    CLAMAV_REQUIRED: bool = False

    DATABASE_URL: SecretStr
    # One public page fans out to several API requests. Keep a bounded burst
    # budget; deployments must multiply this total by their API worker count.
    DATABASE_POOL_SIZE: int = Field(default=10, ge=1, le=50)
    DATABASE_MAX_OVERFLOW: int = Field(default=10, ge=0, le=50)
    DATABASE_POOL_TIMEOUT_SECONDS: float = Field(default=5, gt=0, le=60)

    # The checkout implementation stays inactive until an approved provider
    # adapter, callback URL, and CRM settlement contract are configured.
    PAYMENT_PROVIDER: Literal["disabled", "custom"] = "disabled"
    PAYMENT_CALLBACK_BASE_URL: AnyHttpUrl | None = None
    PAYMENT_REQUEST_URL: AnyHttpUrl | None = None
    PAYMENT_VERIFY_URL: AnyHttpUrl | None = None
    PAYMENT_API_KEY: SecretStr | None = None
    PAYMENT_TIMEOUT_SECONDS: float = Field(default=10, gt=0, le=30)
    AVINA_ERP_API_URL: AnyHttpUrl | None = None
    AVINA_ERP_USERNAME: SecretStr | None = None
    AVINA_ERP_PASSWORD: SecretStr | None = None
    AVINA_ERP_TIMEOUT_SECONDS: float = Field(default=12, gt=0, le=30)
    BOOKING_EXPIRY_SWEEP_SECONDS: int = Field(default=30, ge=5, le=300)

    # Compatibility-only bootstrap settings: no legacy CRM client or webhook is
    # implemented. Native Nora and opt-in Dataverse have independent contracts.
    CRM_BASE_URL: AnyHttpUrl | None = None
    CRM_AUTH_METHOD: Literal["api_key", "oauth2"] = "api_key"
    CRM_API_KEY: SecretStr | None = None
    CRM_WEBHOOK_SECRET: SecretStr | None = None
    CRM_CONNECT_TIMEOUT_SECONDS: float = Field(default=3, gt=0, le=30)
    CRM_READ_TIMEOUT_SECONDS: float = Field(default=10, gt=0, le=60)
    CRM_MAX_RETRIES: int = Field(default=3, ge=0, le=8)

    # Microsoft Dynamics 365 / Dataverse stays opt-in. The API continues to
    # operate normally while this integration is disabled or unconfigured.
    DATAVERSE_ENABLED: bool = False
    DATAVERSE_ENVIRONMENT_URL: AnyHttpUrl | None = None
    DATAVERSE_ENVIRONMENT_ID: str | None = None
    DATAVERSE_TENANT_ID: str | None = None
    DATAVERSE_CLIENT_ID: str | None = None
    DATAVERSE_AUTH_METHOD: Literal["client_secret", "certificate"] = "client_secret"
    DATAVERSE_CLIENT_SECRET: SecretStr | None = None
    DATAVERSE_CERTIFICATE_PATH: str | None = None
    DATAVERSE_CERTIFICATE_THUMBPRINT: str | None = None
    DATAVERSE_APPLICATION_USER_ID: str | None = None
    DATAVERSE_SECURITY_ROLE: str | None = None
    DATAVERSE_API_VERSION: str = "v9.2"
    DATAVERSE_MAPPING_FILE: str | None = None
    DATAVERSE_CONNECT_TIMEOUT_SECONDS: float = Field(default=3, gt=0, le=30)
    DATAVERSE_READ_TIMEOUT_SECONDS: float = Field(default=10, gt=0, le=60)
    DATAVERSE_MAX_RETRIES: int = Field(default=3, ge=0, le=8)
    DATAVERSE_ALLOW_REQUEST_ORDER_WRITE: bool = False

    LEAD_PAYLOAD_ENCRYPTION_KEY: SecretStr
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.05, ge=0, le=1)

    @model_validator(mode="before")
    @classmethod
    def normalise_legacy_sms_ir_settings(cls, values: object) -> object:
        """Keep older SMS.ir env files working after the native adapter rollout."""
        if not isinstance(values, dict):
            return values

        provider = str(values.get("SMS_PROVIDER") or "").strip().casefold()
        request_url = str(values.get("SMS_REQUEST_URL") or "").strip()
        verify_url = str(values.get("SMS_VERIFY_URL") or "").strip()
        request_host = ""
        if request_url:
            try:
                from urllib.parse import urlparse

                request_host = (urlparse(request_url).hostname or "").casefold()
            except ValueError:
                request_host = ""

        is_sms_ir_host = request_host == "sms.ir" or request_host.endswith(".sms.ir")
        if provider == "custom" and is_sms_ir_host and not verify_url:
            values["SMS_PROVIDER"] = "sms_ir"
            provider = "sms_ir"

        if provider == "sms_ir" and request_url.rstrip("/") in {
            "http://sms.ir",
            "https://sms.ir",
            "http://www.sms.ir",
            "https://www.sms.ir",
        }:
            values["SMS_REQUEST_URL"] = "https://api.sms.ir/v1/send/verify"

        if not str(values.get("SMS_LOGIN_TEMPLATE_PARAMETER") or "").strip():
            values["SMS_LOGIN_TEMPLATE_PARAMETER"] = "Code"
        return values

    @model_validator(mode="after")
    def validate_deployment_security(self) -> "Settings":
        """Reject unsafe configuration before staging or production starts."""
        erp_values = (
            self.AVINA_ERP_API_URL,
            self.AVINA_ERP_USERNAME,
            self.AVINA_ERP_PASSWORD,
        )
        if any(value is not None for value in erp_values) and not all(
            value is not None for value in erp_values
        ):
            raise ValueError(
                "AVINA_ERP_API_URL, AVINA_ERP_USERNAME, and AVINA_ERP_PASSWORD "
                "must be configured together"
            )
        if self.APP_ENV not in {"staging", "production"}:
            return self

        errors: list[str] = []
        if self.APP_DEBUG:
            errors.append("APP_DEBUG must be false")
        if self.ADMIN_MFA_ENCRYPTION_KEY is None:
            errors.append("ADMIN_MFA_ENCRYPTION_KEY is required")
        if self.REDIS_URL is None:
            errors.append("REDIS_URL is required for distributed rate limiting")
        if self.PRIVATE_FILE_ENCRYPTION_KEY is None:
            errors.append("PRIVATE_FILE_ENCRYPTION_KEY is required")
        if self.APP_ENV == "production" and not self.CLAMAV_REQUIRED:
            errors.append("CLAMAV_REQUIRED must be true in production")
        if self.CLAMAV_REQUIRED and not self.CLAMAV_HOST:
            errors.append("CLAMAV_HOST is required when CLAMAV_REQUIRED=true")
        if not self.TRUSTED_PROXY_CIDRS:
            errors.append("TRUSTED_PROXY_CIDRS must identify the reverse proxy network")
        if self.ADMIN_SESSION_TTL_MINUTES > 240:
            errors.append("ADMIN_SESSION_TTL_MINUTES must not exceed 240")
        if not self.PUBLIC_SITE_URL.startswith("https://"):
            errors.append("PUBLIC_SITE_URL must use HTTPS")
        else:
            try:
                self.PUBLIC_SITE_URL = public_origin(self.PUBLIC_SITE_URL)
            except ValueError:
                errors.append("PUBLIC_SITE_URL must be a public HTTPS origin")
        if not self.CORS_ALLOWED_ORIGINS or any(
            not origin.startswith("https://") for origin in self.CORS_ALLOWED_ORIGINS
        ):
            errors.append("CORS_ALLOWED_ORIGINS must contain HTTPS origins only")
        if self.PASSWORD_RESET_EMAIL_ENABLED and (
            not self.SMTP_HOST or not self.SMTP_FROM_EMAIL
        ):
            errors.append("SMTP_HOST and SMTP_FROM_EMAIL are required")
        if self.SMS_PROVIDER == "custom" and (
            not self.SMS_REQUEST_URL or not self.SMS_VERIFY_URL or not self.SMS_API_KEY
        ):
            errors.append(
                "SMS_REQUEST_URL, SMS_VERIFY_URL, and SMS_API_KEY are required "
                "when SMS_PROVIDER=custom"
            )
        if self.SMS_PROVIDER == "sms_ir" and (
            not self.SMS_REQUEST_URL
            or not self.SMS_API_KEY
            or not self.SMS_LOGIN_TEMPLATE_TOKEN
        ):
            errors.append(
                "SMS_REQUEST_URL, SMS_API_KEY, and SMS_LOGIN_TEMPLATE_TOKEN "
                "are required when SMS_PROVIDER=sms_ir"
            )
        if (
            self.SMS_PROVIDER == "sms_ir"
            and self.SMS_LOGIN_TEMPLATE_TOKEN is not None
            and not self.SMS_LOGIN_TEMPLATE_TOKEN.get_secret_value().strip().isdigit()
        ):
            errors.append(
                "SMS_LOGIN_TEMPLATE_TOKEN must be a numeric SMS.ir template ID"
            )
        if self.PAYMENT_PROVIDER == "custom" and (
            not self.PAYMENT_CALLBACK_BASE_URL
            or not self.PAYMENT_REQUEST_URL
            or not self.PAYMENT_VERIFY_URL
            or not self.PAYMENT_API_KEY
        ):
            errors.append(
                "PAYMENT_CALLBACK_BASE_URL, PAYMENT_REQUEST_URL, "
                "PAYMENT_VERIFY_URL, and PAYMENT_API_KEY are required when "
                "PAYMENT_PROVIDER=custom"
            )

        unsafe_markers = {"changeme", "replace-locally", "development-only"}
        secrets = {
            "LEAD_PAYLOAD_ENCRYPTION_KEY": (
                self.LEAD_PAYLOAD_ENCRYPTION_KEY.get_secret_value()
            ),
        }
        for name, value in secrets.items():
            normalized = value.strip().casefold()
            if len(value.strip()) < 24 or any(
                marker in normalized for marker in unsafe_markers
            ):
                errors.append(f"{name} must be a strong deployment secret")
        if "local-development-only" in self.DATABASE_URL.get_secret_value().casefold():
            errors.append("DATABASE_URL must not use the development password")
        if errors:
            raise ValueError("; ".join(errors))
        return self

    @field_validator(
        "SMS_REQUEST_URL",
        "SMS_VERIFY_URL",
        "SMS_API_KEY",
        "SMS_LOGIN_TEMPLATE_TOKEN",
        "SMS_FORGOT_PASSWORD_TEMPLATE_TOKEN",
        "SMS_TEMPLATE",
        "SMS_LOGIN_TEMPLATE_PARAMETER",
        "PAYMENT_CALLBACK_BASE_URL",
        "PAYMENT_REQUEST_URL",
        "PAYMENT_VERIFY_URL",
        "PAYMENT_API_KEY",
        "AVINA_ERP_API_URL",
        "AVINA_ERP_USERNAME",
        "AVINA_ERP_PASSWORD",
        "DATAVERSE_ENVIRONMENT_URL",
        "DATAVERSE_ENVIRONMENT_ID",
        "DATAVERSE_TENANT_ID",
        "DATAVERSE_CLIENT_ID",
        "DATAVERSE_CLIENT_SECRET",
        "DATAVERSE_CERTIFICATE_PATH",
        "DATAVERSE_CERTIFICATE_THUMBPRINT",
        "DATAVERSE_APPLICATION_USER_ID",
        "DATAVERSE_SECURITY_ROLE",
        "DATAVERSE_MAPPING_FILE",
        mode="before",
    )
    @classmethod
    def normalise_empty_dataverse_setting(cls, value: object) -> object:
        """Treat empty deployment variables as absent optional configuration."""
        if isinstance(value, str) and not value.strip():
            return None
        if isinstance(value, str):
            return value.strip()
        return value


@lru_cache
def get_settings() -> Settings:
    """Build settings once per process."""
    return Settings()  # type: ignore[call-arg]
