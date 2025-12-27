"""Error handling middleware."""

import traceback
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import (
    PulsarManagerError,
    NotFoundError,
    ValidationError,
    PulsarConnectionError,
    DependencyError,
    RateLimitError,
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware for consistent error response formatting."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as e:
            return self._handle_exception(request, e)

    def _handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """Convert exception to JSON error response."""
        request_id = getattr(request.state, "request_id", "unknown")
        timestamp = datetime.now(timezone.utc).isoformat()

        # Determine status code and error details
        if isinstance(exc, NotFoundError):
            status_code = 404
            error_response = self._format_error(exc, request_id, timestamp)
        elif isinstance(exc, ValidationError):
            status_code = 400
            error_response = self._format_error(exc, request_id, timestamp)
        elif isinstance(exc, DependencyError):
            status_code = 409
            error_response = self._format_error(exc, request_id, timestamp)
        elif isinstance(exc, RateLimitError):
            status_code = 429
            error_response = self._format_error(exc, request_id, timestamp)
            # Add Retry-After header if available
            headers = {}
            if exc.retry_after:
                headers["Retry-After"] = str(exc.retry_after)
            return JSONResponse(
                status_code=status_code,
                content=error_response,
                headers=headers,
            )
        elif isinstance(exc, PulsarConnectionError):
            status_code = 503
            error_response = self._format_error(exc, request_id, timestamp)
        elif isinstance(exc, PulsarManagerError):
            status_code = 500
            error_response = self._format_error(exc, request_id, timestamp)
        else:
            # Unexpected error
            status_code = 500
            logger.error(
                "Unhandled exception",
                error=str(exc),
                error_type=type(exc).__name__,
                traceback=traceback.format_exc(),
            )
            error_response = {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": request_id,
                    "timestamp": timestamp,
                }
            }

        return JSONResponse(status_code=status_code, content=error_response)

    def _format_error(
        self,
        exc: PulsarManagerError,
        request_id: str,
        timestamp: str,
    ) -> dict[str, Any]:
        """Format error response from PulsarManagerError."""
        error_dict: dict[str, Any] = {
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": request_id,
                "timestamp": timestamp,
            }
        }

        if exc.details:
            error_dict["error"]["details"] = exc.details

        return error_dict
