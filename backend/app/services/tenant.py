"""Tenant service for managing Pulsar tenants."""

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DependencyError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.core.events import event_bus
from app.repositories.stats import AggregationRepository
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Pulsar tenant name pattern: alphanumeric, hyphens, underscores
TENANT_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")


class TenantService:
    """Service for managing Pulsar tenants."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService,
        cache: CacheService,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.cache = cache
        self.aggregation_repo = AggregationRepository(session)

    def validate_tenant_name(self, name: str) -> None:
        """Validate tenant name according to Pulsar naming rules."""
        if not name:
            raise ValidationError("Tenant name is required", field="name")

        if len(name) > 64:
            raise ValidationError(
                "Tenant name must be at most 64 characters",
                field="name",
                value=name,
            )

        if not TENANT_NAME_PATTERN.match(name):
            raise ValidationError(
                "Tenant name must start with a letter and contain only "
                "alphanumeric characters, hyphens, and underscores",
                field="name",
                value=name,
            )

    async def get_tenants(self, use_cache: bool = True) -> list[dict[str, Any]]:
        """Get all tenants with statistics."""
        env_id = self.pulsar.environment_id or "default"
        # Try cache first
        if use_cache:
            cached = await self.cache.get_tenants(env_id)
            if cached:
                return cached

        # Fetch from Pulsar
        tenant_names = await self.pulsar.get_tenants()

        tenants = []
        for name in tenant_names:
            tenant_info = await self.pulsar.get_tenant(name)

            tenant_data = {
                "name": name,
                "admin_roles": tenant_info.get("adminRoles", []),
                "allowed_clusters": tenant_info.get("allowedClusters", []),
                "namespace_count": 0,
                "topic_count": 0,
                "total_backlog": 0,
                "msg_rate_in": 0.0,
                "msg_rate_out": 0.0,
            }

            # Get namespaces and aggregate stats
            try:
                namespaces = await self.pulsar.get_namespaces(name)
                tenant_data["namespace_count"] = len(namespaces)

                # Aggregate stats from all namespaces
                total_topics = 0
                total_backlog = 0
                total_rate_in = 0.0
                total_rate_out = 0.0

                for ns in namespaces:
                    ns_name = ns.split("/")[-1] if "/" in ns else ns
                    try:
                        # Get topics in namespace
                        topics = await self.pulsar.get_topics(name, ns_name)
                        total_topics += len(topics)

                        # Get stats for each topic
                        for topic in topics:
                            try:
                                stats = await self.pulsar.get_topic_stats(topic)
                                # Sum msgBacklog from all subscriptions (message count)
                                # instead of backlogSize (which is in bytes)
                                subscriptions = stats.get("subscriptions", {})
                                for sub_stats in subscriptions.values():
                                    total_backlog += sub_stats.get("msgBacklog", 0)
                                total_rate_in += stats.get("msgRateIn", 0)
                                total_rate_out += stats.get("msgRateOut", 0)
                            except Exception:
                                pass
                    except Exception:
                        pass
                
                tenant_data["topic_count"] = total_topics
                tenant_data["total_backlog"] = total_backlog
                tenant_data["msg_rate_in"] = total_rate_in
                tenant_data["msg_rate_out"] = total_rate_out

            except Exception:
                pass

            tenants.append(tenant_data)

        # Cache result
        await self.cache.set_tenants(env_id, tenants)

        return tenants

    async def get_tenant(self, name: str) -> dict[str, Any]:
        """Get tenant details."""
        try:
            tenant_info = await self.pulsar.get_tenant(name)
        except NotFoundError:
            raise NotFoundError("tenant", name)

        # Get aggregated stats
        agg = await self.aggregation_repo.get_by_tenant(name)

        # Get namespaces
        namespaces = await self.pulsar.get_namespaces(name)

        return {
            "name": name,
            "admin_roles": tenant_info.get("adminRoles", []),
            "allowed_clusters": tenant_info.get("allowedClusters", []),
            "namespaces": namespaces,
            "namespace_count": len(namespaces),
            "topic_count": agg.topic_count if agg else 0,
            "total_backlog": agg.total_backlog if agg else 0,
            "total_storage_size": agg.total_storage_size if agg else 0,
            "msg_rate_in": agg.total_msg_rate_in if agg else 0,
            "msg_rate_out": agg.total_msg_rate_out if agg else 0,
        }

    async def create_tenant(
        self,
        name: str,
        admin_roles: list[str] | None = None,
        allowed_clusters: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new tenant."""
        # Validate name
        self.validate_tenant_name(name)

        # If no clusters specified, get available clusters
        if not allowed_clusters:
            allowed_clusters = await self.pulsar.get_clusters()

        # Create tenant
        await self.pulsar.create_tenant(
            tenant=name,
            admin_roles=admin_roles,
            allowed_clusters=allowed_clusters,
        )

        # Invalidate cache
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_tenants(env_id)

        # Publish event
        await event_bus.publish("TENANTS_UPDATED", {"tenant": name, "action": "create"})

        logger.info("Tenant created", tenant=name)

        return {
            "name": name,
            "admin_roles": admin_roles or [],
            "allowed_clusters": allowed_clusters,
        }

    async def update_tenant(
        self,
        name: str,
        admin_roles: list[str] | None = None,
        allowed_clusters: list[str] | None = None,
    ) -> dict[str, Any]:
        """Update tenant configuration."""
        # Verify tenant exists
        try:
            await self.pulsar.get_tenant(name)
        except NotFoundError:
            raise NotFoundError("tenant", name)

        # Update tenant
        await self.pulsar.update_tenant(
            tenant=name,
            admin_roles=admin_roles,
            allowed_clusters=allowed_clusters,
        )

        # Invalidate cache
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_tenants(env_id)

        # Publish event
        await event_bus.publish("TENANTS_UPDATED", {"tenant": name, "action": "update"})

        logger.info("Tenant updated", tenant=name)

        return await self.get_tenant(name)

    async def delete_tenant(self, name: str) -> None:
        """Delete a tenant."""
        # Check for dependent namespaces
        try:
            namespaces = await self.pulsar.get_namespaces(name)
            if namespaces:
                raise DependencyError(
                    resource_type="tenant",
                    resource_id=name,
                    dependent_type="namespace",
                    dependent_count=len(namespaces),
                )
        except NotFoundError:
            raise NotFoundError("tenant", name)

        # Delete tenant
        await self.pulsar.delete_tenant(name)

        # Invalidate cache
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_tenant(env_id, name)

        # Publish event
        await event_bus.publish("TENANTS_UPDATED", {"tenant": name, "action": "delete"})

        logger.info("Tenant deleted", tenant=name)
