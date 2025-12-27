"""Repository layer for data access."""

from app.repositories.base import BaseRepository
from app.repositories.environment import EnvironmentRepository
from app.repositories.audit import AuditRepository
from app.repositories.stats import (
    TopicStatsRepository,
    SubscriptionStatsRepository,
    BrokerStatsRepository,
    AggregationRepository,
)

# Auth & RBAC repositories
from app.repositories.user import UserRepository
from app.repositories.session import SessionRepository
from app.repositories.role import RoleRepository
from app.repositories.permission import PermissionRepository, RolePermissionRepository
from app.repositories.user_role import UserRoleRepository
from app.repositories.api_token import ApiTokenRepository
from app.repositories.oidc_provider import OIDCProviderRepository

__all__ = [
    "BaseRepository",
    "EnvironmentRepository",
    "AuditRepository",
    "TopicStatsRepository",
    "SubscriptionStatsRepository",
    "BrokerStatsRepository",
    "AggregationRepository",
    # Auth & RBAC
    "UserRepository",
    "SessionRepository",
    "RoleRepository",
    "PermissionRepository",
    "RolePermissionRepository",
    "UserRoleRepository",
    "ApiTokenRepository",
    "OIDCProviderRepository",
]
