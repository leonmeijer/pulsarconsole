"""API dependencies for dependency injection."""

from typing import Annotated, AsyncGenerator

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.services import (
    AuditService,
    BrokerService,
    CacheService,
    EnvironmentService,
    MessageBrowserService,
    NamespaceService,
    PulsarAdminService,
    SubscriptionService,
    TenantService,
    TopicService,
)
from app.services.cache import cache_service


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_cache() -> CacheService:
    """Get cache service."""
    return cache_service


async def get_pulsar_client(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[PulsarAdminService, None]:
    """Get Pulsar admin client for the configured environment."""
    env_service = EnvironmentService(session)
    client = await env_service.get_pulsar_client()
    try:
        yield client
    finally:
        await client.close()


async def get_environment_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EnvironmentService:
    """Get environment service."""
    return EnvironmentService(session)


async def get_tenant_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> TenantService:
    """Get tenant service."""
    return TenantService(session, pulsar, cache)


async def get_namespace_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> NamespaceService:
    """Get namespace service."""
    return NamespaceService(session, pulsar, cache)


async def get_topic_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> TopicService:
    """Get topic service."""
    return TopicService(session, pulsar, cache)


async def get_subscription_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> SubscriptionService:
    """Get subscription service."""
    return SubscriptionService(session, pulsar, cache)


async def get_message_browser_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> MessageBrowserService:
    """Get message browser service."""
    return MessageBrowserService(session, pulsar, cache)


async def get_broker_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    pulsar: Annotated[PulsarAdminService, Depends(get_pulsar_client)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> BrokerService:
    """Get broker service."""
    return BrokerService(session, pulsar, cache)


async def get_audit_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuditService:
    """Get audit service."""
    return AuditService(session)


def get_session_id(
    request: Request,
    x_session_id: Annotated[str | None, Header()] = None,
) -> str:
    """Get session ID from header or generate from client IP."""
    if x_session_id:
        return x_session_id
    # Use client IP as fallback
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{client_ip}"


def get_request_info(request: Request) -> dict:
    """Get request info for audit logging."""
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


# Type aliases for dependency injection
DbSession = Annotated[AsyncSession, Depends(get_db)]
Cache = Annotated[CacheService, Depends(get_cache)]
PulsarClient = Annotated[PulsarAdminService, Depends(get_pulsar_client)]
EnvService = Annotated[EnvironmentService, Depends(get_environment_service)]
TenantSvc = Annotated[TenantService, Depends(get_tenant_service)]
NamespaceSvc = Annotated[NamespaceService, Depends(get_namespace_service)]
TopicSvc = Annotated[TopicService, Depends(get_topic_service)]
SubscriptionSvc = Annotated[SubscriptionService, Depends(get_subscription_service)]
MessageBrowserSvc = Annotated[MessageBrowserService, Depends(get_message_browser_service)]
BrokerSvc = Annotated[BrokerService, Depends(get_broker_service)]
AuditSvc = Annotated[AuditService, Depends(get_audit_service)]
SessionId = Annotated[str, Depends(get_session_id)]
RequestInfo = Annotated[dict, Depends(get_request_info)]
