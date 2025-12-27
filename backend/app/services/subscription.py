"""Subscription service for managing Pulsar subscriptions."""

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.repositories.stats import SubscriptionStatsRepository
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Pulsar subscription name pattern
SUBSCRIPTION_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")


class SubscriptionService:
    """Service for managing Pulsar subscriptions."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService,
        cache: CacheService,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.cache = cache
        self.stats_repo = SubscriptionStatsRepository(session)

    def validate_subscription_name(self, name: str) -> None:
        """Validate subscription name according to Pulsar naming rules."""
        if not name:
            raise ValidationError("Subscription name is required", field="name")

        if len(name) > 64:
            raise ValidationError(
                "Subscription name must be at most 64 characters",
                field="name",
                value=name,
            )

        if not SUBSCRIPTION_NAME_PATTERN.match(name):
            raise ValidationError(
                "Subscription name must start with a letter and contain only "
                "alphanumeric characters, hyphens, and underscores",
                field="name",
                value=name,
            )

    async def get_subscriptions(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
        use_cache: bool = True,
    ) -> list[dict[str, Any]]:
        """Get all subscriptions for a topic."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Try cache first
        if use_cache:
            cached = await self.cache.get_subscriptions(full_topic)
            if cached:
                return cached

        # Get topic stats which includes subscription info
        try:
            stats = await self.pulsar.get_topic_stats(full_topic)
        except NotFoundError:
            raise NotFoundError("topic", full_topic)

        subscriptions = []
        for sub_name, sub_stats in stats.get("subscriptions", {}).items():
            # DB stats not used for now
            db_stats = None

            consumers = []
            for consumer in sub_stats.get("consumers", []):
                consumers.append({
                    "consumer_name": consumer.get("consumerName"),
                    "address": consumer.get("address"),
                    "connected_since": consumer.get("connectedSince"),
                    "msg_rate_out": consumer.get("msgRateOut", 0),
                    "msg_throughput_out": consumer.get("msgThroughputOut", 0),
                    "available_permits": consumer.get("availablePermits", 0),
                    "unacked_messages": consumer.get("unackedMessages", 0),
                })

            subscription_data = {
                "name": sub_name,
                "topic": full_topic,
                "type": sub_stats.get("type", "Exclusive"),
                "msg_backlog": sub_stats.get("msgBacklog", 0),
                "msg_rate_out": sub_stats.get("msgRateOut", 0),
                "msg_throughput_out": sub_stats.get("msgThroughputOut", 0),
                "msg_rate_expired": sub_stats.get("msgRateExpired", 0),
                "unacked_messages": sub_stats.get("unackedMessages", 0),
                "consumer_count": len(consumers),
                "consumers": consumers,
                "is_durable": sub_stats.get("isDurable", True),
                "replicated": sub_stats.get("isReplicated", False),
            }

            subscriptions.append(subscription_data)

        # Cache result
        await self.cache.set_subscriptions(full_topic, subscriptions)

        return subscriptions

    async def get_subscription(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get subscription details."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Get topic stats
        try:
            stats = await self.pulsar.get_topic_stats(full_topic)
        except NotFoundError:
            raise NotFoundError("topic", full_topic)

        sub_stats = stats.get("subscriptions", {}).get(subscription)
        if sub_stats is None:
            raise NotFoundError("subscription", f"{full_topic}/{subscription}")

        consumers = []
        for consumer in sub_stats.get("consumers", []):
            consumers.append({
                "consumer_name": consumer.get("consumerName"),
                "address": consumer.get("address"),
                "connected_since": consumer.get("connectedSince"),
                "msg_rate_out": consumer.get("msgRateOut", 0),
                "msg_throughput_out": consumer.get("msgThroughputOut", 0),
                "available_permits": consumer.get("availablePermits", 0),
                "unacked_messages": consumer.get("unackedMessages", 0),
                "blocked_consumer_on_unacked_msgs": consumer.get(
                    "blockedConsumerOnUnackedMsgs", False
                ),
            })

        return {
            "name": subscription,
            "topic": full_topic,
            "type": sub_stats.get("type", "Exclusive"),
            "msg_backlog": sub_stats.get("msgBacklog", 0),
            "msg_rate_out": sub_stats.get("msgRateOut", 0),
            "msg_throughput_out": sub_stats.get("msgThroughputOut", 0),
            "msg_rate_expired": sub_stats.get("msgRateExpired", 0),
            "unacked_messages": sub_stats.get("unackedMessages", 0),
            "consumer_count": len(consumers),
            "consumers": consumers,
            "is_durable": sub_stats.get("isDurable", True),
            "replicated": sub_stats.get("isReplicated", False),
            "non_contiguous_deleted_messages_ranges": sub_stats.get(
                "nonContiguousDeletedMessagesRanges", 0
            ),
        }

    async def create_subscription(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        persistent: bool = True,
        message_id: str = "latest",
    ) -> dict[str, Any]:
        """Create a new subscription."""
        # Validate name
        self.validate_subscription_name(subscription)

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Create subscription
        await self.pulsar.create_subscription(
            full_topic, subscription, message_id
        )

        # Invalidate cache
        await self.cache.invalidate_subscriptions(full_topic)

        logger.info(
            "Subscription created",
            topic=full_topic,
            subscription=subscription,
            message_id=message_id,
        )

        return {
            "name": subscription,
            "topic": full_topic,
            "message_id": message_id,
        }

    async def delete_subscription(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        persistent: bool = True,
        force: bool = False,
    ) -> None:
        """Delete a subscription."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Delete subscription
        await self.pulsar.delete_subscription(full_topic, subscription, force=force)

        # Invalidate cache
        await self.cache.invalidate_subscriptions(full_topic)

        logger.info(
            "Subscription deleted",
            topic=full_topic,
            subscription=subscription,
        )

    async def skip_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        count: int,
        persistent: bool = True,
    ) -> None:
        """Skip messages in a subscription."""
        if count < 1:
            raise ValidationError(
                "Count must be at least 1",
                field="count",
                value=count,
            )

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        await self.pulsar.skip_messages(full_topic, subscription, count)

        # Invalidate cache
        await self.cache.invalidate_subscriptions(full_topic)

        logger.info(
            "Messages skipped",
            topic=full_topic,
            subscription=subscription,
            count=count,
        )

    async def skip_all_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        persistent: bool = True,
    ) -> None:
        """Skip all messages in a subscription (clear backlog)."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        await self.pulsar.skip_all_messages(full_topic, subscription)

        # Invalidate cache
        await self.cache.invalidate_subscriptions(full_topic)

        logger.info(
            "All messages skipped",
            topic=full_topic,
            subscription=subscription,
        )

    async def reset_cursor(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        timestamp: int,
        persistent: bool = True,
    ) -> None:
        """Reset subscription cursor to a specific timestamp."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        await self.pulsar.reset_cursor(full_topic, subscription, timestamp)

        # Invalidate cache
        await self.cache.invalidate_subscriptions(full_topic)

        logger.info(
            "Cursor reset",
            topic=full_topic,
            subscription=subscription,
            timestamp=timestamp,
        )

    async def reset_cursor_to_message_id(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        message_id: str,
        persistent: bool = True,
    ) -> None:
        """Reset subscription cursor to a specific message ID."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # TODO: Implement reset_cursor_to_message_id in PulsarAdminService
        raise NotImplementedError("reset_cursor_to_message_id not yet implemented")

    async def expire_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        expire_time_seconds: int,
        persistent: bool = True,
    ) -> None:
        """Expire messages older than given time."""
        if expire_time_seconds < 1:
            raise ValidationError(
                "Expire time must be at least 1 second",
                field="expire_time_seconds",
                value=expire_time_seconds,
            )

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # TODO: Implement expire_messages in PulsarAdminService
        raise NotImplementedError("expire_messages not yet implemented")

    async def peek_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        count: int = 1,
        persistent: bool = True,
    ) -> list[dict[str, Any]]:
        """Peek at messages in a subscription without consuming them."""
        if count < 1 or count > 100:
            raise ValidationError(
                "Count must be between 1 and 100",
                field="count",
                value=count,
            )

        messages = await self.pulsar.peek_messages(
            tenant, namespace, topic, subscription, count, persistent
        )

        return messages
