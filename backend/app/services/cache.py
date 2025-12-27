"""Redis cache service for caching Pulsar data."""

import json
from datetime import datetime, timezone
from typing import Any, TypeVar

from redis.asyncio import Redis

from app.config import settings
from app.core.logging import get_logger
from app.core.redis import (
    CacheKeys,
    CacheTTL,
    cache_delete,
    cache_delete_pattern,
    cache_get,
    cache_set,
    get_redis_context,
)

logger = get_logger(__name__)

T = TypeVar("T")


class CacheService:
    """Service for caching Pulsar data in Redis."""

    def __init__(self, redis: Redis | None = None) -> None:
        self._redis = redis

    async def get(self, key: str) -> str | None:
        """Get a value from cache."""
        try:
            return await cache_get(key)
        except Exception as e:
            logger.warning("Cache get failed", key=key, error=str(e))
            return None

    async def set(
        self,
        key: str,
        value: str,
        ttl: int | None = None,
    ) -> bool:
        """Set a value in cache with optional TTL."""
        try:
            await cache_set(key, value, ttl or settings.cache_ttl_seconds)
            return True
        except Exception as e:
            logger.warning("Cache set failed", key=key, error=str(e))
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        try:
            await cache_delete(key)
            return True
        except Exception as e:
            logger.warning("Cache delete failed", key=key, error=str(e))
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        try:
            return await cache_delete_pattern(pattern)
        except Exception as e:
            logger.warning("Cache delete pattern failed", pattern=pattern, error=str(e))
            return 0

    # -------------------------------------------------------------------------
    # JSON helpers
    # -------------------------------------------------------------------------

    async def get_json(self, key: str) -> dict | list | None:
        """Get a JSON value from cache."""
        value = await self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.warning("Failed to parse cached JSON", key=key)
        return None

    async def set_json(
        self,
        key: str,
        value: dict | list,
        ttl: int | None = None,
    ) -> bool:
        """Set a JSON value in cache."""
        try:
            json_str = json.dumps(value, default=str)
            return await self.set(key, json_str, ttl)
        except (TypeError, ValueError) as e:
            logger.warning("Failed to serialize to JSON", key=key, error=str(e))
            return False

    # -------------------------------------------------------------------------
    # Cached data with metadata
    # -------------------------------------------------------------------------

    async def get_with_metadata(self, key: str) -> dict[str, Any] | None:
        """Get cached data with age metadata."""
        async with get_redis_context() as redis:
            # Use pipeline for efficiency
            pipe = redis.pipeline()
            pipe.get(key)
            pipe.ttl(key)
            results = await pipe.execute()

            value, ttl = results
            if value is None:
                return None

            try:
                data = json.loads(value)
            except json.JSONDecodeError:
                return None

            # Calculate cache age
            original_ttl = settings.cache_ttl_seconds
            age_seconds = max(0, original_ttl - ttl) if ttl > 0 else original_ttl

            return {
                "data": data,
                "cached_at": (
                    datetime.now(timezone.utc).timestamp() - age_seconds
                ),
                "age_seconds": age_seconds,
                "is_stale": age_seconds > original_ttl * 0.8,
            }

    # -------------------------------------------------------------------------
    # Tenant cache operations
    # -------------------------------------------------------------------------

    async def get_tenants(self) -> list[dict] | None:
        """Get cached tenants list."""
        return await self.get_json(CacheKeys.TENANTS_LIST)

    async def set_tenants(self, tenants: list[dict]) -> bool:
        """Cache tenants list."""
        return await self.set_json(CacheKeys.TENANTS_LIST, tenants, CacheTTL.LISTS)

    async def invalidate_tenants(self) -> bool:
        """Invalidate tenants cache."""
        return await self.delete(CacheKeys.TENANTS_LIST)

    # -------------------------------------------------------------------------
    # Namespace cache operations
    # -------------------------------------------------------------------------

    async def get_namespaces(self, tenant: str) -> list[dict] | None:
        """Get cached namespaces for a tenant."""
        return await self.get_json(CacheKeys.tenant_namespaces(tenant))

    async def set_namespaces(self, tenant: str, namespaces: list[dict]) -> bool:
        """Cache namespaces for a tenant."""
        return await self.set_json(
            CacheKeys.tenant_namespaces(tenant),
            namespaces,
            CacheTTL.LISTS,
        )

    async def invalidate_namespaces(self, tenant: str) -> bool:
        """Invalidate namespaces cache for a tenant."""
        return await self.delete(CacheKeys.tenant_namespaces(tenant))

    # -------------------------------------------------------------------------
    # Topic cache operations
    # -------------------------------------------------------------------------

    async def get_topics(self, tenant: str, namespace: str) -> list[dict] | None:
        """Get cached topics for a namespace."""
        return await self.get_json(CacheKeys.namespace_topics(tenant, namespace))

    async def set_topics(
        self,
        tenant: str,
        namespace: str,
        topics: list[dict],
    ) -> bool:
        """Cache topics for a namespace."""
        return await self.set_json(
            CacheKeys.namespace_topics(tenant, namespace),
            topics,
            CacheTTL.LISTS,
        )

    async def invalidate_topics(self, tenant: str, namespace: str) -> bool:
        """Invalidate topics cache for a namespace."""
        return await self.delete(CacheKeys.namespace_topics(tenant, namespace))

    # -------------------------------------------------------------------------
    # Topic stats cache operations
    # -------------------------------------------------------------------------

    async def get_topic_stats(self, topic: str) -> dict | None:
        """Get cached topic stats."""
        return await self.get_json(CacheKeys.topic_stats(topic))

    async def set_topic_stats(self, topic: str, stats: dict) -> bool:
        """Cache topic stats."""
        return await self.set_json(
            CacheKeys.topic_stats(topic),
            stats,
            CacheTTL.STATS,
        )

    async def invalidate_topic_stats(self, topic: str) -> bool:
        """Invalidate topic stats cache."""
        return await self.delete(CacheKeys.topic_stats(topic))

    # -------------------------------------------------------------------------
    # Subscription cache operations
    # -------------------------------------------------------------------------

    async def get_subscriptions(self, topic: str) -> list[dict] | None:
        """Get cached subscriptions for a topic."""
        return await self.get_json(CacheKeys.topic_subscriptions(topic))

    async def set_subscriptions(self, topic: str, subscriptions: list[dict]) -> bool:
        """Cache subscriptions for a topic."""
        return await self.set_json(
            CacheKeys.topic_subscriptions(topic),
            subscriptions,
            CacheTTL.LISTS,
        )

    async def invalidate_subscriptions(self, topic: str) -> bool:
        """Invalidate subscriptions cache for a topic."""
        return await self.delete(CacheKeys.topic_subscriptions(topic))

    # -------------------------------------------------------------------------
    # Broker cache operations
    # -------------------------------------------------------------------------

    async def get_brokers(self) -> list[dict] | None:
        """Get cached brokers list."""
        return await self.get_json(CacheKeys.BROKER_LIST)

    async def set_brokers(self, brokers: list[dict]) -> bool:
        """Cache brokers list."""
        return await self.set_json(CacheKeys.BROKER_LIST, brokers, CacheTTL.BROKER)

    async def invalidate_brokers(self) -> bool:
        """Invalidate brokers cache."""
        return await self.delete(CacheKeys.BROKER_LIST)

    async def get_broker_stats(self, broker: str) -> dict | None:
        """Get cached broker stats."""
        return await self.get_json(CacheKeys.broker_stats(broker))

    async def set_broker_stats(self, broker: str, stats: dict) -> bool:
        """Cache broker stats."""
        return await self.set_json(
            CacheKeys.broker_stats(broker),
            stats,
            CacheTTL.STATS,
        )

    # -------------------------------------------------------------------------
    # Rate limiting
    # -------------------------------------------------------------------------

    async def check_rate_limit(
        self,
        session_id: str,
        limit: int | None = None,
        window_seconds: int = 60,
    ) -> tuple[bool, int]:
        """
        Check if rate limit is exceeded for message browsing.

        Returns:
            Tuple of (is_allowed, current_count)
        """
        limit = limit or settings.browse_rate_limit_per_minute
        key = CacheKeys.rate_limit_browse(session_id)

        try:
            async with get_redis_context() as redis:
                pipe = redis.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds)
                results = await pipe.execute()

                current_count = results[0]
                is_allowed = current_count <= limit

                return is_allowed, current_count
        except Exception as e:
            logger.warning("Rate limit check failed", session_id=session_id, error=str(e))
            # Fail open - allow request if Redis is unavailable
            return True, 0

    async def get_rate_limit_remaining(
        self,
        session_id: str,
        limit: int | None = None,
    ) -> int:
        """Get remaining rate limit for a session."""
        limit = limit or settings.browse_rate_limit_per_minute
        key = CacheKeys.rate_limit_browse(session_id)

        try:
            async with get_redis_context() as redis:
                current = await redis.get(key)
                if current is None:
                    return limit
                return max(0, limit - int(current))
        except Exception as e:
            logger.warning(
                "Get rate limit remaining failed",
                session_id=session_id,
                error=str(e),
            )
            return limit

    # -------------------------------------------------------------------------
    # Bulk invalidation
    # -------------------------------------------------------------------------

    async def invalidate_tenant(self, tenant: str) -> None:
        """Invalidate all cache entries for a tenant."""
        await self.invalidate_tenants()
        await self.invalidate_namespaces(tenant)
        await self.delete_pattern(f"namespace:{tenant}/*")

    async def invalidate_namespace(self, tenant: str, namespace: str) -> None:
        """Invalidate all cache entries for a namespace."""
        await self.invalidate_namespaces(tenant)
        await self.invalidate_topics(tenant, namespace)

    async def invalidate_topic(self, topic: str) -> None:
        """Invalidate all cache entries for a topic."""
        await self.invalidate_topic_stats(topic)
        await self.invalidate_subscriptions(topic)

    async def invalidate_all(self) -> int:
        """Invalidate all cache entries."""
        return await self.delete_pattern("*")


# Singleton instance
cache_service = CacheService()
