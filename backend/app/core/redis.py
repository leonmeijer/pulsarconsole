"""Redis connection and cache utilities."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import settings

# Global Redis connection pool
_redis_pool: Redis | None = None


async def init_redis() -> Redis:
    """Initialize Redis connection pool."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.from_url(
            settings.redis_url,
            password=settings.redis_password,
            encoding="utf-8",
            decode_responses=True,
            max_connections=10,
        )
    return _redis_pool


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.close()
        _redis_pool = None


async def get_redis() -> AsyncGenerator[Redis, None]:
    """Get Redis client for dependency injection."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await init_redis()
    yield _redis_pool


@asynccontextmanager
async def get_redis_context() -> AsyncGenerator[Redis, None]:
    """Get Redis client as context manager."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await init_redis()
    yield _redis_pool


class CacheKeys:
    """Cache key patterns for different resources."""

    ENVIRONMENT_CONFIG = "environment:config"
    TENANTS_LIST = "tenants:list"
    TENANT_NAMESPACES = "tenant:{tenant}:namespaces"
    NAMESPACE_TOPICS = "namespace:{tenant}/{namespace}:topics"
    TOPIC_STATS = "topic:{topic}:stats"
    TOPIC_SUBSCRIPTIONS = "topic:{topic}:subscriptions"
    BROKER_LIST = "broker:list"
    BROKER_STATS = "broker:{broker}:stats"
    RATE_LIMIT_BROWSE = "ratelimit:browse:{session_id}"

    @classmethod
    def tenant_namespaces(cls, tenant: str) -> str:
        """Get cache key for tenant's namespaces."""
        return cls.TENANT_NAMESPACES.format(tenant=tenant)

    @classmethod
    def namespace_topics(cls, tenant: str, namespace: str) -> str:
        """Get cache key for namespace's topics."""
        return cls.NAMESPACE_TOPICS.format(tenant=tenant, namespace=namespace)

    @classmethod
    def topic_stats(cls, topic: str) -> str:
        """Get cache key for topic stats."""
        return cls.TOPIC_STATS.format(topic=topic)

    @classmethod
    def topic_subscriptions(cls, topic: str) -> str:
        """Get cache key for topic subscriptions."""
        return cls.TOPIC_SUBSCRIPTIONS.format(topic=topic)

    @classmethod
    def broker_stats(cls, broker: str) -> str:
        """Get cache key for broker stats."""
        return cls.BROKER_STATS.format(broker=broker)

    @classmethod
    def rate_limit_browse(cls, session_id: str) -> str:
        """Get cache key for browse rate limiting."""
        return cls.RATE_LIMIT_BROWSE.format(session_id=session_id)


class CacheTTL:
    """Cache TTL values in seconds."""

    ENVIRONMENT = 300  # 5 minutes
    LISTS = 10  # 10 seconds for tenant/namespace lists with stats
    STATS = 30  # 30 seconds
    BROKER = 5  # 5 seconds for real-time metrics
    RATE_LIMIT = 60  # 1 minute


async def cache_get(key: str) -> str | None:
    """Get value from cache."""
    async with get_redis_context() as r:
        return await r.get(key)


async def cache_set(key: str, value: str, ttl: int | None = None) -> None:
    """Set value in cache with optional TTL."""
    async with get_redis_context() as r:
        if ttl:
            await r.setex(key, ttl, value)
        else:
            await r.set(key, value)


async def cache_delete(key: str) -> None:
    """Delete key from cache."""
    async with get_redis_context() as r:
        await r.delete(key)


async def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching pattern."""
    async with get_redis_context() as r:
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        return deleted


async def cache_invalidate_tenant(tenant: str) -> None:
    """Invalidate all cache entries for a tenant."""
    await cache_delete(CacheKeys.TENANTS_LIST)
    await cache_delete(CacheKeys.tenant_namespaces(tenant))
    await cache_delete_pattern(f"namespace:{tenant}/*")


async def cache_invalidate_namespace(tenant: str, namespace: str) -> None:
    """Invalidate all cache entries for a namespace."""
    await cache_delete(CacheKeys.tenant_namespaces(tenant))
    await cache_delete(CacheKeys.namespace_topics(tenant, namespace))


async def cache_invalidate_topic(topic: str) -> None:
    """Invalidate all cache entries for a topic."""
    await cache_delete(CacheKeys.topic_stats(topic))
    await cache_delete(CacheKeys.topic_subscriptions(topic))
