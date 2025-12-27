"""SQLAlchemy database models."""

from app.models.base import BaseModel, TimestampMixin, UUIDMixin
from app.models.environment import Environment, AuthMode, OIDCMode, RBACSyncMode
from app.models.audit import AuditEvent
from app.models.stats import TopicStats, SubscriptionStats, BrokerStats, Aggregation

# Auth & RBAC models
from app.models.user import User
from app.models.session import Session
from app.models.role import Role
from app.models.permission import Permission, PermissionAction, ResourceLevel
from app.models.role_permission import RolePermission
from app.models.user_role import UserRole
from app.models.api_token import ApiToken
from app.models.oidc_provider import OIDCProvider

__all__ = [
    # Base
    "BaseModel",
    "TimestampMixin",
    "UUIDMixin",
    # Environment
    "Environment",
    "AuthMode",
    "OIDCMode",
    "RBACSyncMode",
    # Audit
    "AuditEvent",
    # Stats
    "TopicStats",
    "SubscriptionStats",
    "BrokerStats",
    "Aggregation",
    # Auth & RBAC
    "User",
    "Session",
    "Role",
    "Permission",
    "PermissionAction",
    "ResourceLevel",
    "RolePermission",
    "UserRole",
    "ApiToken",
    "OIDCProvider",
]
