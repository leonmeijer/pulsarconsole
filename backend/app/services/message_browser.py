"""Message browser service for browsing Pulsar messages."""

import base64
import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, RateLimitError, ValidationError
from app.core.logging import get_logger
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)


class MessageBrowserService:
    """Service for browsing Pulsar messages with rate limiting."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService,
        cache: CacheService,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.cache = cache

    async def check_rate_limit(self, session_id: str) -> None:
        """Check if rate limit is exceeded for this session."""
        is_allowed, count = await self.cache.check_rate_limit(session_id)
        if not is_allowed:
            remaining = await self.cache.get_rate_limit_remaining(session_id)
            raise RateLimitError(
                message="Message browsing rate limit exceeded. Please wait before trying again.",
                limit=count,
                remaining=remaining,
            )

    def decode_message_payload(
        self,
        payload: bytes | str,
        encoding: str = "utf-8",
    ) -> dict[str, Any]:
        """Decode message payload and return decoded content with metadata."""
        if isinstance(payload, str):
            # Already a string, try to parse as JSON
            try:
                return {
                    "type": "json",
                    "content": json.loads(payload),
                    "raw": payload,
                }
            except json.JSONDecodeError:
                return {
                    "type": "text",
                    "content": payload,
                    "raw": payload,
                }

        # Binary payload
        try:
            # Try UTF-8 decode first
            text = payload.decode(encoding)
            # Try to parse as JSON
            try:
                return {
                    "type": "json",
                    "content": json.loads(text),
                    "raw": text,
                }
            except json.JSONDecodeError:
                return {
                    "type": "text",
                    "content": text,
                    "raw": text,
                }
        except UnicodeDecodeError:
            # Binary data, base64 encode
            return {
                "type": "binary",
                "content": base64.b64encode(payload).decode("ascii"),
                "raw": None,
                "size": len(payload),
            }

    async def browse_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        session_id: str,
        count: int = 10,
        persistent: bool = True,
        start_message_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Browse messages from a subscription.

        This uses peek to get messages without consuming them.
        """
        # Rate limit check
        await self.check_rate_limit(session_id)

        # Validate count
        if count < 1:
            raise ValidationError("Count must be at least 1", field="count", value=count)
        if count > 100:
            raise ValidationError(
                "Count cannot exceed 100", field="count", value=count
            )

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Peek messages
        try:
            raw_messages = await self.pulsar.peek_messages(
                tenant, namespace, topic, subscription, count, persistent
            )
        except NotFoundError:
            raise NotFoundError("subscription", f"{full_topic}/{subscription}")

        # Process messages
        messages = []
        for i, msg in enumerate(raw_messages):
            payload = msg.get("payload", b"")
            decoded = self.decode_message_payload(payload)

            message_data = {
                "index": i,
                "message_id": msg.get("messageId"),
                "publish_time": msg.get("publishTime"),
                "producer_name": msg.get("producerName"),
                "properties": msg.get("properties", {}),
                "payload": decoded,
                "key": msg.get("key"),
                "event_time": msg.get("eventTime"),
                "redelivery_count": msg.get("redeliveryCount", 0),
            }
            messages.append(message_data)

        # Get rate limit info
        remaining = await self.cache.get_rate_limit_remaining(session_id)

        return {
            "topic": full_topic,
            "subscription": subscription,
            "messages": messages,
            "message_count": len(messages),
            "rate_limit_remaining": remaining,
        }

    async def get_message_by_id(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        message_id: str,
        session_id: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get a specific message by its ID."""
        # Rate limit check
        await self.check_rate_limit(session_id)

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        # Parse message ID (format: ledgerId:entryId)
        try:
            parts = message_id.split(":")
            if len(parts) != 2:
                raise ValueError("Invalid format")
            ledger_id = int(parts[0])
            entry_id = int(parts[1])
        except (ValueError, IndexError) as e:
            raise ValidationError(
                "Message ID must be in format 'ledgerId:entryId'",
                field="message_id",
                value=message_id,
            ) from e

        # Get message
        try:
            msg = await self.pulsar.get_message_by_id(
                tenant, namespace, topic, ledger_id, entry_id, persistent
            )
        except NotFoundError:
            raise NotFoundError("message", message_id)

        payload = msg.get("payload", b"")
        decoded = self.decode_message_payload(payload)

        return {
            "topic": full_topic,
            "message_id": message_id,
            "publish_time": msg.get("publishTime"),
            "producer_name": msg.get("producerName"),
            "properties": msg.get("properties", {}),
            "payload": decoded,
            "key": msg.get("key"),
            "event_time": msg.get("eventTime"),
        }

    async def get_last_message_id(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get the last message ID for a topic."""
        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        try:
            result = await self.pulsar.get_last_message_id(
                tenant, namespace, topic, persistent
            )
        except NotFoundError:
            raise NotFoundError("topic", full_topic)

        return {
            "topic": full_topic,
            "ledger_id": result.get("ledgerId"),
            "entry_id": result.get("entryId"),
            "partition_index": result.get("partitionIndex", -1),
            "message_id": f"{result.get('ledgerId')}:{result.get('entryId')}",
        }

    async def examine_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        session_id: str,
        initial_position: str = "latest",
        count: int = 10,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """
        Examine messages from a topic without a subscription.

        Uses the admin API to read messages directly from the topic.
        """
        # Rate limit check
        await self.check_rate_limit(session_id)

        # Validate
        if count < 1:
            raise ValidationError("Count must be at least 1", field="count", value=count)
        if count > 100:
            raise ValidationError(
                "Count cannot exceed 100", field="count", value=count
            )
        if initial_position not in ("earliest", "latest"):
            raise ValidationError(
                "Initial position must be 'earliest' or 'latest'",
                field="initial_position",
                value=initial_position,
            )

        persistence = "persistent" if persistent else "non-persistent"
        full_topic = f"{persistence}://{tenant}/{namespace}/{topic}"

        try:
            raw_messages = await self.pulsar.examine_messages(
                tenant, namespace, topic, initial_position, count, persistent
            )
        except NotFoundError:
            raise NotFoundError("topic", full_topic)

        # Process messages
        messages = []
        for i, msg in enumerate(raw_messages):
            payload = msg.get("payload", b"")
            decoded = self.decode_message_payload(payload)

            message_data = {
                "index": i,
                "message_id": msg.get("messageId"),
                "publish_time": msg.get("publishTime"),
                "producer_name": msg.get("producerName"),
                "properties": msg.get("properties", {}),
                "payload": decoded,
                "key": msg.get("key"),
                "event_time": msg.get("eventTime"),
            }
            messages.append(message_data)

        # Get rate limit info
        remaining = await self.cache.get_rate_limit_remaining(session_id)

        return {
            "topic": full_topic,
            "initial_position": initial_position,
            "messages": messages,
            "message_count": len(messages),
            "rate_limit_remaining": remaining,
        }
