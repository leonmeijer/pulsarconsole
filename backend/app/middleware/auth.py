"""Authentication middleware."""

from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger
from app.core.security import verify_access_token, hash_value

logger = get_logger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = {
    "/",
    "/health",
    "/ready",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/callback",
    "/api/v1/auth/providers",
    "/api/v1/auth/refresh",
}

# Path prefixes that don't require authentication
PUBLIC_PATH_PREFIXES = (
    "/api/v1/auth/",
    "/static/",
)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware for handling authentication.

    This middleware:
    1. Extracts JWT tokens from Authorization header or cookies
    2. Validates the token
    3. Attaches user info to request state
    4. Allows requests to proceed (actual authorization is done in dependencies)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if path requires authentication
        path = request.url.path

        if self._is_public_path(path):
            return await call_next(request)

        # Initialize auth state
        request.state.user = None
        request.state.user_id = None
        request.state.auth_type = None  # "jwt", "api_token", or None

        # Try to extract and validate token
        token = self._extract_token(request)

        if token:
            auth_type, user_id = await self._validate_token(token)
            if user_id:
                request.state.user_id = user_id
                request.state.auth_type = auth_type
                logger.debug(
                    "Request authenticated",
                    user_id=str(user_id),
                    auth_type=auth_type,
                )

        # Continue processing - actual authorization is handled by dependencies
        return await call_next(request)

    def _is_public_path(self, path: str) -> bool:
        """Check if the path is public (doesn't require auth)."""
        if path in PUBLIC_PATHS:
            return True

        for prefix in PUBLIC_PATH_PREFIXES:
            if path.startswith(prefix):
                return True

        return False

    def _extract_token(self, request: Request) -> str | None:
        """
        Extract authentication token from request.

        Checks in order:
        1. Authorization header (Bearer token)
        2. X-API-Token header (API tokens)
        3. Session cookie
        """
        # Check Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]

        # Check X-API-Token header
        api_token = request.headers.get("X-API-Token")
        if api_token:
            return api_token

        # Check session cookie
        from app.config import settings
        cookie_token = request.cookies.get(settings.session_cookie_name)
        if cookie_token:
            return cookie_token

        return None

    async def _validate_token(self, token: str) -> tuple[str | None, str | None]:
        """
        Validate the token and return (auth_type, user_id).

        Returns:
            Tuple of (auth_type, user_id) or (None, None) if invalid
        """
        # Check if it's a JWT access token
        payload = verify_access_token(token)
        if payload:
            return "jwt", payload.sub

        # Check if it's an API token (starts with pc_)
        if token.startswith("pc_"):
            # API token validation requires database access
            # This is handled in the dependency instead
            return "api_token", None

        return None, None


class OptionalAuthMiddleware(AuthMiddleware):
    """
    Auth middleware that doesn't require authentication.

    Same as AuthMiddleware but all paths are treated as public.
    Useful for environments where auth is disabled.
    """

    def _is_public_path(self, path: str) -> bool:
        """All paths are public in optional auth mode."""
        return True
