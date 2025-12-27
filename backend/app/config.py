"""Application configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
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
        default="postgresql+asyncpg://pulsar:pulsar@localhost:5432/pulsar_manager"
    )
    database_pool_size: int = Field(default=5)
    database_max_overflow: int = Field(default=10)
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
    pulsar_auth_token: str | None = Field(default=None)
    pulsar_tls_enabled: bool = Field(default=False)
    pulsar_tls_allow_insecure: bool = Field(default=True)

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
    otel_service_name: str = Field(default="pulsar-manager-api")
    otel_exporter_otlp_endpoint: str = Field(default="http://localhost:4317")

    # -------------------------------------------------------------------------
    # Prometheus Metrics
    # -------------------------------------------------------------------------
    metrics_enabled: bool = Field(default=True)
    metrics_path: str = Field(default="/metrics")

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


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Convenience export
settings = get_settings()
