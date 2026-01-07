"""Application configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Literal
import os
import subprocess
import json

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application Settings
    # -------------------------------------------------------------------------
    app_name: str = Field(default="pulsar-manager-api")
    app_env: Literal["development", "staging", "production"] = Field(default="development")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")

    # -------------------------------------------------------------------------
    # Server Settings
    # -------------------------------------------------------------------------
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    workers: int = Field(default=1)

    # -------------------------------------------------------------------------
    # Database (PostgreSQL)
    # -------------------------------------------------------------------------
    database_url: str = Field(
        default="postgresql+asyncpg://pulsar:pulsar@localhost:5432/pulsar_console"
    )
    database_pool_size: int = Field(default=3)
    database_max_overflow: int = Field(default=5)
    database_echo: bool = Field(default=False)

    # -------------------------------------------------------------------------
    # Redis Cache
    # -------------------------------------------------------------------------
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_password: str | None = Field(default=None)
    cache_ttl_seconds: int = Field(default=60)

    # -------------------------------------------------------------------------
    # Pulsar Cluster
    # -------------------------------------------------------------------------
    pulsar_admin_url: str = Field(default="http://localhost:8080")
    pulsar_service_url: str = Field(default="pulsar://localhost:6650")
    pulsar_cluster: str = Field(default="standalone")
    pulsar_auth_token: str | None = Field(default=None)
    pulsar_tls_enabled: bool = Field(default=False)
    pulsar_tls_allow_insecure: bool = Field(default=True)

    # Pulsar OAuth2 (Machine-to-Machine)
    pulsar_auth_enabled: bool = Field(default=False)
    pulsar_oauth_issuer_url: str | None = Field(default=None)
    pulsar_oauth_client_id: str | None = Field(default=None)
    pulsar_oauth_client_secret: str | None = Field(default=None)
    pulsar_oauth_audience: str | None = Field(default=None)

    # Connection settings
    pulsar_connect_timeout: int = Field(default=10)
    pulsar_read_timeout: int = Field(default=30)
    pulsar_max_retries: int = Field(default=3)

    # -------------------------------------------------------------------------
    # Celery Worker
    # -------------------------------------------------------------------------
    celery_broker_url: str = Field(default="redis://localhost:6379/1")
    celery_result_backend: str = Field(default="redis://localhost:6379/2")

    # Stats collection intervals (seconds)
    stats_collection_interval: int = Field(default=30)
    broker_stats_interval: int = Field(default=60)
    aggregation_interval: int = Field(default=60)
    cleanup_interval: int = Field(default=86400)

    # -------------------------------------------------------------------------
    # Security
    # -------------------------------------------------------------------------
    secret_key: str = Field(default="change-me-in-production")
    encryption_key: str = Field(default="change-me-in-production")

    # -------------------------------------------------------------------------
    # Authentication (JWT)
    # -------------------------------------------------------------------------
    jwt_secret_key: str = Field(default="change-me-in-production-jwt")
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_expire_minutes: int = Field(default=15)
    jwt_refresh_token_expire_days: int = Field(default=7)

    # -------------------------------------------------------------------------
    # OIDC (Optional - configured per environment)
    # -------------------------------------------------------------------------
    # Global OIDC settings (can be overridden per environment)
    # When OIDC is disabled, authentication is bypassed (dev mode)
    # When OIDC is enabled, users must authenticate via the configured provider
    oidc_enabled: bool = Field(default=False)
    oidc_issuer_url: str | None = Field(default=None)
    oidc_client_id: str | None = Field(default=None)
    oidc_client_secret: str | None = Field(default=None)  # Optional when using PKCE
    oidc_use_pkce: bool = Field(default=True)  # Use PKCE by default (recommended)

    # -------------------------------------------------------------------------
    # Session Settings
    # -------------------------------------------------------------------------
    session_cookie_name: str = Field(default="pulsar_console_session")
    session_cookie_secure: bool = Field(default=True)
    session_cookie_httponly: bool = Field(default=True)
    session_cookie_samesite: Literal["lax", "strict", "none"] = Field(default="lax")

    # -------------------------------------------------------------------------
    # Message Browsing Limits
    # -------------------------------------------------------------------------
    max_messages_per_request: int = Field(default=100)
    max_message_payload_size: int = Field(default=1048576)  # 1MB
    browse_rate_limit_per_minute: int = Field(default=10)

    # -------------------------------------------------------------------------
    # CORS Settings
    # -------------------------------------------------------------------------
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")
    cors_allow_credentials: bool = Field(default=True)

    # -------------------------------------------------------------------------
    # OpenTelemetry
    # -------------------------------------------------------------------------
    otel_enabled: bool = Field(default=False)
    otel_service_name: str = Field(default="pulsar-console-api")
    otel_exporter_otlp_endpoint: str = Field(default="http://localhost:4317")

    # -------------------------------------------------------------------------
    # Prometheus Metrics
    # -------------------------------------------------------------------------
    metrics_enabled: bool = Field(default=True)
    metrics_path: str = Field(default="/metrics")

    # -------------------------------------------------------------------------
    # Elastic APM
    # -------------------------------------------------------------------------
    elastic_apm_enabled: bool = Field(default=False)
    elastic_apm_server_url: str | None = Field(default=None)
    elastic_apm_secret_token: str | None = Field(default=None)
    elastic_apm_service_name: str = Field(default="pulsar-console-api")

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------
    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"

    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"

    @model_validator(mode="after")
    def resolve_bws_secrets(self) -> "Settings":
        """Resolve any values starting with bws:// using environment variables or BWS CLI."""
        for field_name, value in self.__dict__.items():
            if isinstance(value, str) and value.startswith("bws://"):
                # 1. Try environment variable with prefix (set by bws run)
                # We use the field name in uppercase as per standard env var conventions
                env_key = f"pulsar-console-react-{field_name.upper()}"
                env_value = os.environ.get(env_key)

                if env_value:
                    setattr(self, field_name, env_value)
                    continue

                # 2. Try environment variable without prefix (if bws run used non-prefixed keys)
                env_key_no_prefix = field_name.upper()
                env_value_no_prefix = os.environ.get(env_key_no_prefix)
                if env_value_no_prefix and not env_value_no_prefix.startswith("bws://"):
                    setattr(self, field_name, env_value_no_prefix)
                    continue

                # 3. Fallback: Call BWS CLI to fetch the secret by ID
                secret_id = value.replace("bws://", "")
                try:
                    # Note: This is slow and should be avoided in production by using 'bws run'
                    result = subprocess.run(
                        ["bws", "secret", "get", secret_id],
                        capture_output=True,
                        text=True,
                        check=True,
                        timeout=5
                    )
                    secret_data = json.loads(result.stdout)
                    if "value" in secret_data:
                        setattr(self, field_name, secret_data["value"])
                except Exception:
                    # If resolution fails, the bws:// string remains
                    pass
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Convenience export
settings = get_settings()
