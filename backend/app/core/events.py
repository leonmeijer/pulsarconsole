"""Redis Pub/Sub event bus for real-time updates."""

import json
from typing import Any, Dict, Optional
from uuid import UUID

from app.core.logging import get_logger
from app.core.redis import get_redis_context

logger = get_logger(__name__)

# Redis channel name for all system events
EVENTS_CHANNEL = "pulsar_console_events"

class EventBus:
    """Central event bus for publishing and subscribing to system events."""

    async def publish(self, event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
        """
        Publish an event to the Redis channel.
        
        Args:
            event_type: The type of event (e.g., 'TENANTS_UPDATED')
            data: Optional dictionary with additional event data
        """
        event = {
            "type": event_type,
            "data": data or {},
        }
        
        try:
            async with get_redis_context() as redis:
                await redis.publish(EVENTS_CHANNEL, json.dumps(event, default=str))
                logger.debug("Published event", event_type=event_type)
        except Exception as e:
            logger.error("Failed to publish event", event_type=event_type, error=str(e))

    async def subscribe(self):
        """
        Get a Redis pubsub object subscribed to the events channel.
        
        Returns:
            A Redis PubSub object
        """
        async with get_redis_context() as redis:
            pubsub = redis.pubsub()
            await pubsub.subscribe(EVENTS_CHANNEL)
            return pubsub

# Global event bus instance
event_bus = EventBus()

