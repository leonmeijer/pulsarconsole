"""FastAPI middleware."""

from app.middleware.error_handler import ErrorHandlerMiddleware
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.auth import AuthMiddleware, OptionalAuthMiddleware
from app.middleware.rbac import RBACMiddleware, StrictRBACMiddleware

__all__ = [
    "ErrorHandlerMiddleware",
    "MetricsMiddleware",
    "RequestLoggingMiddleware",
    "AuthMiddleware",
    "OptionalAuthMiddleware",
    "RBACMiddleware",
    "StrictRBACMiddleware",
]
