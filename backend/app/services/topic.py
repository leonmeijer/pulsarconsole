"""Topic service for managing Pulsar topics."""

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DependencyError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.core.events import event_bus
from app.repositories.stats import TopicStatsRepository
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Pulsar topic name pattern
TOPIC_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,127}$")


class TopicService:
    """Service for managing Pulsar topics."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService,
        cache: CacheService,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.cache = cache
        self.stats_repo = TopicStatsRepository(session)

    def validate_topic_name(self, name: str) -> None:
        """Validate topic name according to Pulsar naming rules."""
        if not name:
            raise ValidationError("Topic name is required", field="name")

        if len(name) > 128:
            raise ValidationError(
                "Topic name must be at most 128 characters",
                field="name",
                value=name,
            )

        if not TOPIC_NAME_PATTERN.match(name):
            raise ValidationError(
                "Topic name must start with a letter and contain only "
                "alphanumeric characters, hyphens, and underscores",
                field="name",
                value=name,
            )

    def parse_topic_name(self, full_name: str) -> dict[str, str]:
        """Parse a full topic name into components."""
        # Format: persistent://tenant/namespace/topic or non-persistent://...
        parts = full_name.split("://")
        if len(parts) != 2:
            return {"name": full_name, "persistent": True}

        persistence = parts[0]
        path_parts = parts[1].split("/")

        if len(path_parts) >= 3:
            return {
                "persistent": persistence == "persistent",
                "tenant": path_parts[0],
                "namespace": path_parts[1],
                "name": "/".join(path_parts[2:]),
                "full_name": full_name,
            }
        return {"name": full_name, "persistent": True}

    async def get_topics(
        self,
        tenant: str,
        namespace: str,
        persistent: bool = True,
        use_cache: bool = True,
    ) -> list[dict[str, Any]]:
        """Get all topics for a namespace."""
        env_id = self.pulsar.environment_id or "default"
        # Try cache first
        if use_cache:
            cached = await self.cache.get_topics(env_id, tenant, namespace)
            if cached:
                return cached

        # Fetch from Pulsar
        topic_names = await self.pulsar.get_topics(tenant, namespace, persistent)

        topics = []
        for full_name in topic_names:
            parsed = self.parse_topic_name(full_name)

            # Get stats from DB if available
            topic_name = parsed.get("name", full_name)
            stats = await self.stats_repo.get_latest_by_topic(tenant, namespace, topic_name)

            topic_data = {
                "tenant": tenant,
                "namespace": namespace,
                "name": parsed.get("name", full_name),
                "full_name": full_name,
                "persistent": parsed.get("persistent", persistent),
                "producer_count": stats.producer_count if stats else 0,
                "subscription_count": stats.subscription_count if stats else 0,
                "msg_rate_in": stats.msg_rate_in if stats else 0,
                "msg_rate_out": stats.msg_rate_out if stats else 0,
                "msg_throughput_in": stats.msg_throughput_in if stats else 0,
                "msg_throughput_out": stats.msg_throughput_out if stats else 0,
                "storage_size": stats.storage_size if stats else 0,
                "backlog_size": stats.backlog_size if stats else 0,
            }

            topics.append(topic_data)

        # Cache result
        await self.cache.set_topics(env_id, tenant, namespace, topics)

        return topics

    async def get_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get topic details with stats."""
        persistence = "persistent" if persistent else "non-persistent"
        full_name = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Get stats from Pulsar
        try:
            stats = await self.pulsar.get_topic_stats(full_name)
        except NotFoundError:
            raise NotFoundError("topic", full_name)

        # Get internal stats (not yet implemented, return empty)
        internal_stats = {}

        # Get subscriptions
        subscriptions = []
        for sub_name, sub_stats in stats.get("subscriptions", {}).items():
            subscriptions.append({
                "name": sub_name,
                "type": sub_stats.get("type", "Exclusive"),
                "msg_backlog": sub_stats.get("msgBacklog", 0),
                "msg_rate_out": sub_stats.get("msgRateOut", 0),
                "consumer_count": len(sub_stats.get("consumers", [])),
            })

        # Get producers
        producers = []
        for prod_stats in stats.get("publishers", []):
            producers.append({
                "producer_id": prod_stats.get("producerId"),
                "producer_name": prod_stats.get("producerName"),
                "address": prod_stats.get("address"),
                "msg_rate_in": prod_stats.get("msgRateIn", 0),
                "msg_throughput_in": prod_stats.get("msgThroughputIn", 0),
            })

        return {
            "tenant": tenant,
            "namespace": namespace,
            "name": topic,
            "full_name": full_name,
            "persistent": persistent,
            "stats": {
                "msg_rate_in": stats.get("msgRateIn", 0),
                "msg_rate_out": stats.get("msgRateOut", 0),
                "msg_throughput_in": stats.get("msgThroughputIn", 0),
                "msg_throughput_out": stats.get("msgThroughputOut", 0),
                "average_msg_size": stats.get("averageMsgSize", 0),
                "storage_size": stats.get("storageSize", 0),
                "backlog_size": stats.get("backlogSize", 0),
            },
            "internal_stats": {
                "entries_added_counter": internal_stats.get("entriesAddedCounter", 0),
                "number_of_entries": internal_stats.get("numberOfEntries", 0),
                "total_size": internal_stats.get("totalSize", 0),
                "current_ledger_entries": internal_stats.get("currentLedgerEntries", 0),
                "current_ledger_size": internal_stats.get("currentLedgerSize", 0),
            },
            "producers": producers,
            "subscriptions": subscriptions,
            "producer_count": len(producers),
            "subscription_count": len(subscriptions),
        }

    async def create_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
        partitions: int = 0,
    ) -> dict[str, Any]:
        """Create a new topic."""
        # Validate name
        self.validate_topic_name(topic)

        persistence = "persistent" if persistent else "non-persistent"
        full_name = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Create topic
        if partitions > 0:
            await self.pulsar.create_partitioned_topic(
                tenant, namespace, topic, partitions, persistent
            )
        else:
            await self.pulsar.create_topic(tenant, namespace, topic, persistent)

        # Invalidate cache
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_topics(env_id, tenant, namespace)

        # Publish event
        await event_bus.publish("TOPICS_UPDATED", {"tenant": tenant, "namespace": namespace, "topic": topic, "action": "create"})

        logger.info(
            "Topic created",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
            partitions=partitions,
        )

        return {
            "tenant": tenant,
            "namespace": namespace,
            "name": topic,
            "full_name": full_name,
            "persistent": persistent,
            "partitions": partitions,
        }

    async def delete_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
        force: bool = False,
    ) -> None:
        """Delete a topic."""
        persistence = "persistent" if persistent else "non-persistent"
        full_name = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Check for active subscriptions if not forcing
        if not force:
            try:
                stats = await self.pulsar.get_topic_stats(full_name)
                subscriptions = stats.get("subscriptions", {})
                if subscriptions:
                    raise DependencyError(
                        resource_type="topic",
                        resource_id=full_name,
                        dependent_type="subscription",
                        dependent_count=len(subscriptions),
                    )
            except NotFoundError:
                raise NotFoundError("topic", full_name)

        # Delete topic
        await self.pulsar.delete_topic(tenant, namespace, topic, persistent, force)

        # Invalidate caches
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_topics(env_id, tenant, namespace)
        await self.cache.invalidate_topic(env_id, full_name)

        # Publish event
        await event_bus.publish("TOPICS_UPDATED", {"tenant": tenant, "namespace": namespace, "topic": topic, "action": "delete"})

        logger.info(
            "Topic deleted",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
        )

    async def get_partitions(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> int:
        """Get the number of partitions for a partitioned topic."""
        try:
            metadata = await self.pulsar.get_partitioned_topic_metadata(
                tenant, namespace, topic, persistent
            )
            return metadata.get("partitions", 0)
        except NotFoundError:
            return 0

    async def update_partitions(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        partitions: int,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Update the number of partitions for a partitioned topic."""
        if partitions < 1:
            raise ValidationError(
                "Partitions must be at least 1",
                field="partitions",
                value=partitions,
            )

        current = await self.get_partitions(tenant, namespace, topic, persistent)
        if partitions <= current:
            raise ValidationError(
                f"New partition count ({partitions}) must be greater than current ({current})",
                field="partitions",
                value=partitions,
            )

        await self.pulsar.update_partitioned_topic(
            tenant, namespace, topic, partitions, persistent
        )

        # Invalidate cache
        env_id = self.pulsar.environment_id or "default"
        await self.cache.invalidate_topics(env_id, tenant, namespace)

        logger.info(
            "Topic partitions updated",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
            partitions=partitions,
        )

        persistence = "persistent" if persistent else "non-persistent"
        return {
            "tenant": tenant,
            "namespace": namespace,
            "name": topic,
            "full_name": f"{persistence}://{tenant}/{namespace}/{topic}",
            "partitions": partitions,
        }

    async def unload_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Unload a topic from the broker."""
        await self.pulsar.unload_topic(tenant, namespace, topic, persistent)
        logger.info(
            "Topic unloaded",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
        )

    async def compact_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Trigger compaction on a topic."""
        await self.pulsar.compact_topic(tenant, namespace, topic, persistent)
        logger.info(
            "Topic compaction triggered",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
        )

    async def offload_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Trigger offload on a topic."""
        await self.pulsar.offload_topic(tenant, namespace, topic, persistent)
        logger.info(
            "Topic offload triggered",
            tenant=tenant,
            namespace=namespace,
            topic=topic,
        )
