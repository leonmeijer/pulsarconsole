"""Namespace service for managing Pulsar namespaces."""

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DependencyError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.repositories.stats import AggregationRepository
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Pulsar namespace name pattern
NAMESPACE_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")


class NamespaceService:
    """Service for managing Pulsar namespaces."""

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

    def validate_namespace_name(self, name: str) -> None:
        """Validate namespace name according to Pulsar naming rules."""
        if not name:
            raise ValidationError("Namespace name is required", field="name")

        if len(name) > 64:
            raise ValidationError(
                "Namespace name must be at most 64 characters",
                field="name",
                value=name,
            )

        if not NAMESPACE_NAME_PATTERN.match(name):
            raise ValidationError(
                "Namespace name must start with a letter and contain only "
                "alphanumeric characters, hyphens, and underscores",
                field="name",
                value=name,
            )

    async def get_namespaces(
        self,
        tenant: str,
        use_cache: bool = True,
    ) -> list[dict[str, Any]]:
        """Get all namespaces for a tenant."""
        # Try cache first
        if use_cache:
            cached = await self.cache.get_namespaces(tenant)
            if cached:
                return cached

        # Fetch from Pulsar
        namespace_names = await self.pulsar.get_namespaces(tenant)

        namespaces = []
        for full_name in namespace_names:
            # full_name is "tenant/namespace"
            parts = full_name.split("/")
            ns_name = parts[-1] if len(parts) > 1 else full_name

            # Get policies
            try:
                policies = await self.pulsar.get_namespace_policies(tenant, ns_name)
            except Exception:
                policies = {}

            # Get aggregated stats
            agg = await self.aggregation_repo.get_by_namespace(tenant, ns_name)

            namespace_data = {
                "tenant": tenant,
                "namespace": ns_name,
                "full_name": f"{tenant}/{ns_name}",
                "policies": {
                    "retention_time_minutes": policies.get("retention_policies", {}).get(
                        "retentionTimeInMinutes"
                    ),
                    "retention_size_mb": policies.get("retention_policies", {}).get(
                        "retentionSizeInMB"
                    ),
                    "message_ttl_seconds": policies.get("message_ttl_in_seconds"),
                    "backlog_quota": policies.get("backlog_quota_map", {}),
                },
                "topic_count": agg.topic_count if agg else 0,
                "total_backlog": agg.total_backlog if agg else 0,
                "total_storage_size": agg.total_storage_size if agg else 0,
                "msg_rate_in": agg.total_msg_rate_in if agg else 0,
                "msg_rate_out": agg.total_msg_rate_out if agg else 0,
            }

            namespaces.append(namespace_data)

        # Cache result
        await self.cache.set_namespaces(tenant, namespaces)

        return namespaces

    async def get_namespace(self, tenant: str, namespace: str) -> dict[str, Any]:
        """Get namespace details."""
        try:
            policies = await self.pulsar.get_namespace_policies(tenant, namespace)
        except NotFoundError:
            raise NotFoundError("namespace", f"{tenant}/{namespace}")

        # Get topics
        persistent_topics = await self.pulsar.get_topics(tenant, namespace, persistent=True)
        non_persistent_topics = await self.pulsar.get_topics(
            tenant, namespace, persistent=False
        )

        # Get aggregated stats
        agg = await self.aggregation_repo.get_by_namespace(tenant, namespace)

        return {
            "tenant": tenant,
            "namespace": namespace,
            "full_name": f"{tenant}/{namespace}",
            "policies": {
                "retention_time_minutes": policies.get("retention_policies", {}).get(
                    "retentionTimeInMinutes"
                ),
                "retention_size_mb": policies.get("retention_policies", {}).get(
                    "retentionSizeInMB"
                ),
                "message_ttl_seconds": policies.get("message_ttl_in_seconds"),
                "backlog_quota": policies.get("backlog_quota_map", {}),
                "deduplication_enabled": policies.get("deduplicationEnabled"),
                "schema_compatibility_strategy": policies.get("schema_compatibility_strategy"),
            },
            "persistent_topics": persistent_topics,
            "non_persistent_topics": non_persistent_topics,
            "topic_count": len(persistent_topics) + len(non_persistent_topics),
            "total_backlog": agg.total_backlog if agg else 0,
            "total_storage_size": agg.total_storage_size if agg else 0,
            "msg_rate_in": agg.total_msg_rate_in if agg else 0,
            "msg_rate_out": agg.total_msg_rate_out if agg else 0,
        }

    async def create_namespace(self, tenant: str, namespace: str) -> dict[str, Any]:
        """Create a new namespace."""
        # Validate name
        self.validate_namespace_name(namespace)

        # Create namespace
        await self.pulsar.create_namespace(tenant, namespace)

        # Invalidate cache
        await self.cache.invalidate_namespaces(tenant)

        logger.info("Namespace created", tenant=tenant, namespace=namespace)

        return {
            "tenant": tenant,
            "namespace": namespace,
            "full_name": f"{tenant}/{namespace}",
        }

    async def update_policies(
        self,
        tenant: str,
        namespace: str,
        retention_time_minutes: int | None = None,
        retention_size_mb: int | None = None,
        message_ttl_seconds: int | None = None,
        deduplication_enabled: bool | None = None,
        schema_compatibility_strategy: str | None = None,
    ) -> dict[str, Any]:
        """Update namespace policies."""
        # Verify namespace exists
        try:
            await self.pulsar.get_namespace_policies(tenant, namespace)
        except NotFoundError:
            raise NotFoundError("namespace", f"{tenant}/{namespace}")

        # Update retention if provided
        if retention_time_minutes is not None or retention_size_mb is not None:
            await self.pulsar.set_retention(
                tenant,
                namespace,
                retention_time_minutes if retention_time_minutes is not None else -1,
                retention_size_mb if retention_size_mb is not None else -1,
            )

        # Update message TTL if provided
        if message_ttl_seconds is not None:
            await self.pulsar.set_message_ttl(tenant, namespace, message_ttl_seconds)

        # Update deduplication if provided
        if deduplication_enabled is not None:
            await self.pulsar.set_deduplication(tenant, namespace, deduplication_enabled)

        # Update schema compatibility if provided
        if schema_compatibility_strategy is not None:
            await self.pulsar.set_schema_compatibility_strategy(
                tenant, namespace, schema_compatibility_strategy
            )

        # Invalidate cache
        await self.cache.invalidate_namespaces(tenant)

        logger.info("Namespace policies updated", tenant=tenant, namespace=namespace)

        return await self.get_namespace(tenant, namespace)

    async def delete_namespace(self, tenant: str, namespace: str) -> None:
        """Delete a namespace."""
        # Check for dependent topics
        try:
            topics = await self.pulsar.get_topics(tenant, namespace, persistent=True)
            topics.extend(await self.pulsar.get_topics(tenant, namespace, persistent=False))
            if topics:
                raise DependencyError(
                    resource_type="namespace",
                    resource_id=f"{tenant}/{namespace}",
                    dependent_type="topic",
                    dependent_count=len(topics),
                )
        except NotFoundError:
            raise NotFoundError("namespace", f"{tenant}/{namespace}")

        # Delete namespace
        await self.pulsar.delete_namespace(tenant, namespace)

        # Invalidate cache
        await self.cache.invalidate_namespace(tenant, namespace)

        logger.info("Namespace deleted", tenant=tenant, namespace=namespace)
