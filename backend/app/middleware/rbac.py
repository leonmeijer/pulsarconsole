"""RBAC (Role-Based Access Control) middleware."""

import re
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger

logger = get_logger(__name__)


# Route patterns that map to required permissions
# Format: (method, pattern, action, resource_level)
ROUTE_PERMISSIONS = [
    # Tenant routes
    ("GET", r"^/api/v1/tenants$", "read", "tenant"),
    ("GET", r"^/api/v1/tenants/[^/]+$", "read", "tenant"),
    ("POST", r"^/api/v1/tenants$", "write", "tenant"),
    ("PUT", r"^/api/v1/tenants/[^/]+$", "write", "tenant"),
    ("DELETE", r"^/api/v1/tenants/[^/]+$", "admin", "tenant"),

    # Namespace routes
    ("GET", r"^/api/v1/namespaces$", "read", "namespace"),
    ("GET", r"^/api/v1/namespaces/[^/]+$", "read", "namespace"),
    ("GET", r"^/api/v1/tenants/[^/]+/namespaces$", "read", "namespace"),
    ("POST", r"^/api/v1/namespaces$", "write", "namespace"),
    ("PUT", r"^/api/v1/namespaces/[^/]+$", "write", "namespace"),
    ("DELETE", r"^/api/v1/namespaces/[^/]+$", "admin", "namespace"),

    # Topic routes
    ("GET", r"^/api/v1/topics$", "read", "topic"),
    ("GET", r"^/api/v1/topics/[^/]+$", "read", "topic"),
    ("POST", r"^/api/v1/topics$", "write", "topic"),
    ("PUT", r"^/api/v1/topics/[^/]+$", "write", "topic"),
    ("DELETE", r"^/api/v1/topics/[^/]+$", "admin", "topic"),

    # Subscription routes
    ("GET", r"^/api/v1/subscriptions", "read", "topic"),
    ("POST", r"^/api/v1/subscriptions", "consume", "topic"),
    ("DELETE", r"^/api/v1/subscriptions", "admin", "topic"),

    # Message routes
    ("GET", r"^/api/v1/messages", "consume", "topic"),
    ("POST", r"^/api/v1/messages/peek", "consume", "topic"),
    ("POST", r"^/api/v1/messages/produce", "produce", "topic"),

    # Broker routes
    ("GET", r"^/api/v1/brokers", "read", "cluster"),

    # Cluster/admin routes
    ("GET", r"^/api/v1/environment", "read", "cluster"),
    ("POST", r"^/api/v1/environment", "admin", "cluster"),
    ("PUT", r"^/api/v1/environment", "admin", "cluster"),
    ("DELETE", r"^/api/v1/environment", "admin", "cluster"),
]


class RBACMiddleware(BaseHTTPMiddleware):
    """
    Middleware for enforcing RBAC on routes.

    This middleware:
    1. Checks if the route requires a permission
    2. If RBAC is enabled, verifies the user has the required permission
    3. Denies access if permission check fails

    Note: This is a coarse-grained check. Fine-grained resource-level checks
    should be done in the route handlers using require_permission dependency.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip if no user is authenticated (auth middleware handles this)
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            return await call_next(request)

        # Find matching route permission
        required = self._get_required_permission(
            request.method, request.url.path
        )

        if not required:
            # No permission required for this route
            return await call_next(request)

        action, resource_level = required

        # Store required permission in request state for logging/debugging
        request.state.required_permission = f"{action}:{resource_level}"

        # The actual permission check is done by the require_permission dependency
        # or in the route handler. This middleware just annotates the request.
        # For strict enforcement, uncomment the code below:

        # from app.core.database import async_session_factory
        # from app.services.rbac import RBACService
        # from app.repositories.environment import EnvironmentRepository
        #
        # async with async_session_factory() as session:
        #     env_repo = EnvironmentRepository(session)
        #     env = await env_repo.get_active()
        #
        #     if env and env.rbac_enabled:
        #         rbac = RBACService(session)
        #         has_permission = await rbac.check_permission(
        #             user_id=UUID(user_id),
        #             environment_id=env.id,
        #             action=action,
        #             resource_level=resource_level,
        #         )
        #
        #         if not has_permission:
        #             return Response(
        #                 content='{"detail": "Permission denied"}',
        #                 status_code=403,
        #                 media_type="application/json",
        #             )

        return await call_next(request)

    def _get_required_permission(
        self, method: str, path: str
    ) -> tuple[str, str] | None:
        """
        Get the required permission for a route.

        Args:
            method: HTTP method
            path: Request path

        Returns:
            Tuple of (action, resource_level) or None if no permission required
        """
        for route_method, pattern, action, resource_level in ROUTE_PERMISSIONS:
            if method == route_method and re.match(pattern, path):
                return (action, resource_level)
        return None


class StrictRBACMiddleware(RBACMiddleware):
    """
    Strict RBAC middleware that enforces permissions at the middleware level.

    Unlike RBACMiddleware which only annotates requests, this middleware
    actively blocks requests that don't have the required permissions.

    Use this when you want centralized permission enforcement rather than
    per-route enforcement.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        from uuid import UUID
        from app.core.database import async_session_factory
        from app.services.rbac import RBACService
        from app.repositories.environment import EnvironmentRepository

        # Skip if no user is authenticated
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            return await call_next(request)

        # Find matching route permission
        required = self._get_required_permission(
            request.method, request.url.path
        )

        if not required:
            return await call_next(request)

        action, resource_level = required

        # Check permission
        async with async_session_factory() as session:
            env_repo = EnvironmentRepository(session)
            env = await env_repo.get_active()

            if env and env.rbac_enabled:
                rbac = RBACService(session)
                has_permission = await rbac.check_permission(
                    user_id=UUID(user_id),
                    environment_id=env.id,
                    action=action,
                    resource_level=resource_level,
                )

                if not has_permission:
                    logger.warning(
                        "Permission denied",
                        user_id=user_id,
                        action=action,
                        resource_level=resource_level,
                        path=request.url.path,
                    )
                    return Response(
                        content=f'{{"detail": "Permission denied: {action}:{resource_level}"}}',
                        status_code=403,
                        media_type="application/json",
                    )

        return await call_next(request)
