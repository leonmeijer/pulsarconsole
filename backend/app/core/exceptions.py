"""Custom exceptions for Pulsar Manager API."""

from typing import Any


class PulsarManagerError(Exception):
    """Base exception for all Pulsar Manager errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class NotFoundError(PulsarManagerError):
    """Resource not found error."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        message: str | None = None,
    ) -> None:
        super().__init__(
            message=message or f"{resource_type} '{resource_id}' not found",
            code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
        )
        self.resource_type = resource_type
        self.resource_id = resource_id


class ValidationError(PulsarManagerError):
    """Validation error for invalid input."""

    def __init__(
        self,
        message: str,
        field: str | None = None,
        value: Any = None,
    ) -> None:
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)

        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            details=details,
        )
        self.field = field
        self.value = value


class PulsarConnectionError(PulsarManagerError):
    """Error connecting to Pulsar cluster."""

    def __init__(
        self,
        message: str,
        url: str | None = None,
        original_error: Exception | None = None,
    ) -> None:
        details = {}
        if url:
            details["url"] = url
        if original_error:
            details["original_error"] = str(original_error)

        super().__init__(
            message=message,
            code="PULSAR_CONNECTION_ERROR",
            details=details,
        )
        self.url = url
        self.original_error = original_error


class CacheError(PulsarManagerError):
    """Error with cache operations."""

    def __init__(
        self,
        message: str,
        operation: str | None = None,
        key: str | None = None,
    ) -> None:
        details = {}
        if operation:
            details["operation"] = operation
        if key:
            details["key"] = key

        super().__init__(
            message=message,
            code="CACHE_ERROR",
            details=details,
        )
        self.operation = operation
        self.key = key


class DependencyError(PulsarManagerError):
    """Error when operation blocked by dependencies."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        dependent_type: str,
        dependent_count: int,
    ) -> None:
        super().__init__(
            message=f"Cannot delete {resource_type} '{resource_id}': "
            f"{dependent_count} {dependent_type}(s) depend on it",
            code="DEPENDENCY_ERROR",
            details={
                "resource_type": resource_type,
                "resource_id": resource_id,
                "dependent_type": dependent_type,
                "dependent_count": dependent_count,
            },
        )
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.dependent_type = dependent_type
        self.dependent_count = dependent_count


class RateLimitError(PulsarManagerError):
    """Rate limit exceeded error."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: int | None = None,
    ) -> None:
        details = {}
        if retry_after:
            details["retry_after"] = retry_after

        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            details=details,
        )
        self.retry_after = retry_after


class DatabaseError(PulsarManagerError):
    """Database operation error."""

    def __init__(
        self,
        message: str,
        operation: str | None = None,
        original_error: Exception | None = None,
    ) -> None:
        details = {}
        if operation:
            details["operation"] = operation
        if original_error:
            details["original_error"] = str(original_error)

        super().__init__(
            message=message,
            code="DATABASE_ERROR",
            details=details,
        )
        self.operation = operation
        self.original_error = original_error
