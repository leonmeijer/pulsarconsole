"""Statistics collection tasks."""

import asyncio
from datetime import datetime, timezone

from app.config import settings
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.core.events import event_bus
from app.models.stats import BrokerStats, SubscriptionStats, TopicStats
from app.repositories.environment import EnvironmentRepository
from app.repositories.stats import (
    BrokerStatsRepository,
    SubscriptionStatsRepository,
    TopicStatsRepository,
)
from app.services.pulsar_admin import PulsarAdminService
from app.worker.celery_app import celery_app

logger = get_logger(__name__)


def run_async(coro):
    """Run async coroutine in sync context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_pulsar_client() -> PulsarAdminService | None:
    """Get Pulsar client from environment configuration."""
    async with async_session_factory() as session:
        env_repo = EnvironmentRepository(session)
        envs = await env_repo.get_all(limit=1)
        if not envs:
            return None
        env = envs[0]
        token = env_repo.get_decrypted_token(env)
        return PulsarAdminService(admin_url=env.admin_url, auth_token=token)


async def _collect_topic_stats_async():
    """Async implementation of topic stats collection."""
    client = await _get_pulsar_client()
    if client is None:
        logger.warning("No environment configured, skipping topic stats collection")
        return 0

    collected = 0
    try:
        # Get all tenants
        tenants = await client.get_tenants()

        all_stats = []
        for tenant in tenants:
            try:
                namespaces = await client.get_namespaces(tenant)
                for ns_full in namespaces:
                    ns = ns_full.split("/")[-1] if "/" in ns_full else ns_full
                    try:
                        # Get persistent topics
                        topics = await client.get_topics(tenant, ns, persistent=True)
                        for topic_full in topics:
                            try:
                                # Extract topic name
                                parts = topic_full.replace("persistent://", "").split("/")
                                topic_name = parts[-1] if len(parts) > 2 else topic_full

                                stats = await client.get_topic_stats(
                                    tenant, ns, topic_name, persistent=True
                                )

                                topic_stats = TopicStats(
                                    topic=topic_full,
                                    tenant=tenant,
                                    namespace=ns,
                                    producer_count=len(stats.get("publishers", [])),
                                    subscription_count=len(stats.get("subscriptions", {})),
                                    msg_rate_in=stats.get("msgRateIn", 0),
                                    msg_rate_out=stats.get("msgRateOut", 0),
                                    msg_throughput_in=stats.get("msgThroughputIn", 0),
                                    msg_throughput_out=stats.get("msgThroughputOut", 0),
                                    storage_size=stats.get("storageSize", 0),
                                    backlog_size=stats.get("backlogSize", 0),
                                    collected_at=datetime.now(timezone.utc),
                                )
                                all_stats.append(topic_stats)
                            except Exception as e:
                                logger.warning(
                                    "Failed to get stats for topic",
                                    topic=topic_full,
                                    error=str(e),
                                )
                    except Exception as e:
                        logger.warning(
                            "Failed to get topics for namespace",
                            namespace=ns_full,
                            error=str(e),
                        )
            except Exception as e:
                logger.warning(
                    "Failed to get namespaces for tenant",
                    tenant=tenant,
                    error=str(e),
                )

        # Batch insert stats
        if all_stats:
            async with async_session_factory() as session:
                repo = TopicStatsRepository(session)
                await repo.batch_insert(all_stats)
                collected = len(all_stats)
        
        # Trigger real-time UI refresh for stats and lists
        # This ensures changes made outside the console are eventually reflected
        await event_bus.publish("TOPICS_UPDATED")
        await event_bus.publish("NAMESPACES_UPDATED")
        await event_bus.publish("TENANTS_UPDATED")

    finally:
        await client.close()

    return collected


async def _collect_subscription_stats_async():
    """Async implementation of subscription stats collection."""
    client = await _get_pulsar_client()
    if client is None:
        logger.warning("No environment configured, skipping subscription stats collection")
        return 0

    collected = 0
    try:
        tenants = await client.get_tenants()

        all_stats = []
        for tenant in tenants:
            try:
                namespaces = await client.get_namespaces(tenant)
                for ns_full in namespaces:
                    ns = ns_full.split("/")[-1] if "/" in ns_full else ns_full
                    try:
                        topics = await client.get_topics(tenant, ns, persistent=True)
                        for topic_full in topics:
                            try:
                                parts = topic_full.replace("persistent://", "").split("/")
                                topic_name = parts[-1] if len(parts) > 2 else topic_full

                                stats = await client.get_topic_stats(
                                    tenant, ns, topic_name, persistent=True
                                )

                                for sub_name, sub_stats in stats.get("subscriptions", {}).items():
                                    sub = SubscriptionStats(
                                        topic=topic_full,
                                        subscription=sub_name,
                                        tenant=tenant,
                                        namespace=ns,
                                        msg_backlog=sub_stats.get("msgBacklog", 0),
                                        msg_rate_out=sub_stats.get("msgRateOut", 0),
                                        msg_throughput_out=sub_stats.get("msgThroughputOut", 0),
                                        consumer_count=len(sub_stats.get("consumers", [])),
                                        subscription_type=sub_stats.get("type", "Exclusive"),
                                        collected_at=datetime.now(timezone.utc),
                                    )
                                    all_stats.append(sub)
                            except Exception as e:
                                logger.warning(
                                    "Failed to get subscription stats",
                                    topic=topic_full,
                                    error=str(e),
                                )
                    except Exception:
                        pass
            except Exception:
                pass

        if all_stats:
            async with async_session_factory() as session:
                repo = SubscriptionStatsRepository(session)
                await repo.batch_insert(all_stats)
                collected = len(all_stats)

    finally:
        await client.close()

    return collected


async def _collect_broker_stats_async():
    """Async implementation of broker stats collection."""
    client = await _get_pulsar_client()
    if client is None:
        logger.warning("No environment configured, skipping broker stats collection")
        return 0

    collected = 0
    try:
        brokers = await client.get_active_brokers()

        all_stats = []
        for broker_url in brokers:
            try:
                stats = await client.get_broker_stats(broker_url)
                load = await client.get_broker_load(broker_url)

                broker_stats = BrokerStats(
                    broker=broker_url,
                    topics_count=stats.get("numTopics", 0),
                    bundles_count=stats.get("numBundles", 0),
                    producers_count=stats.get("numProducers", 0),
                    consumers_count=stats.get("numConsumers", 0),
                    msg_rate_in=stats.get("msgRateIn", 0),
                    msg_rate_out=stats.get("msgRateOut", 0),
                    msg_throughput_in=stats.get("msgThroughputIn", 0),
                    msg_throughput_out=stats.get("msgThroughputOut", 0),
                    cpu_usage=load.get("cpu", {}).get("usage", 0),
                    memory_usage=load.get("memory", {}).get("usage", 0),
                    direct_memory_usage=load.get("directMemory", {}).get("usage", 0),
                    collected_at=datetime.now(timezone.utc),
                )
                all_stats.append(broker_stats)
            except Exception as e:
                logger.warning(
                    "Failed to get stats for broker",
                    broker=broker_url,
                    error=str(e),
                )

        if all_stats:
            async with async_session_factory() as session:
                repo = BrokerStatsRepository(session)
                await repo.batch_insert(all_stats)
                collected = len(all_stats)
        
        # Trigger UI refresh for brokers
        await event_bus.publish("BROKERS_UPDATED")

    finally:
        await client.close()

    return collected


@celery_app.task(bind=True, max_retries=3)
def collect_topic_stats(self):
    """Collect statistics for all topics."""
    logger.info("Starting topic stats collection")
    try:
        collected = run_async(_collect_topic_stats_async())
        logger.info("Topic stats collection completed", collected=collected)
        return {"collected": collected}
    except Exception as e:
        logger.error("Topic stats collection failed", error=str(e))
        raise self.retry(exc=e, countdown=5 * (self.request.retries + 1))


@celery_app.task(bind=True, max_retries=3)
def collect_subscription_stats(self):
    """Collect statistics for all subscriptions."""
    logger.info("Starting subscription stats collection")
    try:
        collected = run_async(_collect_subscription_stats_async())
        logger.info("Subscription stats collection completed", collected=collected)
        return {"collected": collected}
    except Exception as e:
        logger.error("Subscription stats collection failed", error=str(e))
        raise self.retry(exc=e, countdown=5 * (self.request.retries + 1))


@celery_app.task(bind=True, max_retries=3)
def collect_broker_stats(self):
    """Collect statistics for all brokers."""
    logger.info("Starting broker stats collection")
    try:
        collected = run_async(_collect_broker_stats_async())
        logger.info("Broker stats collection completed", collected=collected)
        return {"collected": collected}
    except Exception as e:
        logger.error("Broker stats collection failed", error=str(e))
        raise self.retry(exc=e, countdown=5 * (self.request.retries + 1))
