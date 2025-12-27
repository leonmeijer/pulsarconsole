"""API dependencies for dependency injection."""

from typing import Annotated, AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.security import verify_access_token, hash_value
from app.models.user import User
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
from app.services.notification import NotificationService
from app.services.cache import cache_service
from app.services.auth import AuthService

# Security scheme for OpenAPI
oauth2_scheme = HTTPBearer(auto_error=False)


async def has_superuser_access(user: User, db: AsyncSession) -> bool:
    """
    Check if a user has superuser access.

    A user has superuser access if they have the "superuser" role in any environment.
    """
    from sqlalchemy import select
    from app.models.role import Role
    from app.models.user_role import UserRole

    result = await db.execute(
        select(UserRole)
        .join(Role, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            Role.name == "superuser",
        )
    )
    return result.scalar_one_or_none() is not None


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


async def get_notification_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationService:
    """Get notification service."""
    return NotificationService(session)


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


async def get_request_info(
    request: Request,
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> dict:
    """Get request info for audit logging, including user context."""
    from app.config import settings

    # Base request info
    info = {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }

    # Add user context based on authentication mode
    if settings.oidc_enabled:
        # OIDC is enabled - use authenticated user if available
        if current_user:
            info["user_id"] = str(current_user.id)
            info["user_email"] = current_user.email or current_user.display_name or "Unknown"
        else:
            # OIDC enabled but no user (unauthenticated request)
            info["user_id"] = None
            info["user_email"] = "Anonymous"
    else:
        # OIDC not enabled - use System user
        info["user_id"] = "system"
        info["user_email"] = "System user"

    return info


# =============================================================================
# Authentication Dependencies
# =============================================================================


async def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuthService:
    """Get authentication service."""
    return AuthService(session)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Get the current authenticated user.

    Raises HTTPException 401 if not authenticated.
    """
    token = None

    # Try Bearer token first
    if credentials:
        token = credentials.credentials

    # Try session cookie
    if not token:
        from app.config import settings
        token = request.cookies.get(settings.session_cookie_name)

    # Try API token header
    if not token:
        token = request.headers.get("X-API-Token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = AuthService(db)

    # Check if it's an API token
    if token.startswith("pc_"):
        user = await auth_service.validate_api_token(token)
    else:
        user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """
    Get the current user if authenticated, None otherwise.

    Does not raise exception if not authenticated.
    """
    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Get the current active user.

    Raises HTTPException 403 if user is deactivated.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return current_user


async def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Get the current superuser.

    A user is considered a superuser if they have the "superuser" role
    in any environment.

    Raises HTTPException 403 if user is not a superuser.
    """
    if not await has_superuser_access(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser privileges required",
        )
    return current_user


def require_permission(
    action: str,
    resource_level: str,
    resource_path: str | None = None,
):
    """
    Dependency factory for requiring a specific permission.

    Usage:
        @router.get("/tenants")
        async def list_tenants(
            user: Annotated[User, Depends(require_permission("read", "tenant"))]
        ):
            ...
    """
    async def permission_dependency(
        request: Request,
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        # Superusers have all permissions (via flag or superuser role)
        if await has_superuser_access(current_user, db):
            return current_user

        from app.models.permission import PermissionAction, ResourceLevel
        from app.repositories.user_role import UserRoleRepository
        from app.repositories.environment import EnvironmentRepository

        # Get active environment
        env_repo = EnvironmentRepository(db)
        environment = await env_repo.get_active()

        if not environment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active environment configured",
            )

        # If RBAC is not enabled, allow all
        if not environment.rbac_enabled:
            return current_user

        # Check permission
        user_role_repo = UserRoleRepository(db)
        has_permission = await user_role_repo.check_permission(
            user_id=current_user.id,
            environment_id=environment.id,
            action=PermissionAction(action),
            resource_level=ResourceLevel(resource_level),
            resource_path=resource_path,
        )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action}:{resource_level}",
            )

        return current_user

    return permission_dependency


# =============================================================================
# Type aliases for dependency injection
# =============================================================================

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
NotificationSvc = Annotated[NotificationService, Depends(get_notification_service)]
SessionId = Annotated[str, Depends(get_session_id)]
RequestInfo = Annotated[dict, Depends(get_request_info)]

# Auth type aliases
AuthSvc = Annotated[AuthService, Depends(get_auth_service)]
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]
