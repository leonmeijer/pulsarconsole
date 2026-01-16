"""Statistics collection tasks."""

import asyncio
from datetime import datetime, timezone

from app.config import settings
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.core.events import event_bus
from app.models.stats import BrokerStats, SubscriptionStats, TopicStats
from app.repositories.environment import EnvironmentRepository
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


async def _get_pulsar_client() -> tuple[PulsarAdminService, str] | tuple[None, None]:
    """Get Pulsar client and environment ID from environment configuration."""
    async with async_session_factory() as session:
        env_repo = EnvironmentRepository(session)
        envs = await env_repo.get_all(limit=1)
        if not envs:
            return None, None
        env = envs[0]
        token = env_repo.get_decrypted_token(env)
        return PulsarAdminService(admin_url=env.admin_url, auth_token=token), str(env.id)


async def _collect_topic_stats_async():
    """Async implementation of topic stats collection."""
    client, env_id = await _get_pulsar_client()
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

                                stats = await client.get_topic_stats(topic_full)

                                topic_stats = TopicStats(
                                    environment_id=env_id,
                                    topic=topic_name,
                                    tenant=tenant,
                                    namespace=ns,
                                    msg_rate_in=stats.get("msgRateIn", 0),
                                    msg_rate_out=stats.get("msgRateOut", 0),
                                    msg_throughput_in=stats.get("msgThroughputIn", 0),
                                    msg_throughput_out=stats.get("msgThroughputOut", 0),
                                    storage_size=int(stats.get("storageSize", 0)),
                                    backlog_size=int(stats.get("backlogSize", 0)),
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
                session.add_all(all_stats)
                await session.commit()
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
    client, env_id = await _get_pulsar_client()
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

                                stats = await client.get_topic_stats(topic_full)

                                for sub_name, sub_stats in stats.get("subscriptions", {}).items():
                                    sub = SubscriptionStats(
                                        environment_id=env_id,
                                        topic=topic_name,
                                        subscription=sub_name,
                                        tenant=tenant,
                                        namespace=ns,
                                        msg_backlog=int(sub_stats.get("msgBacklog", 0)),
                                        msg_rate_out=sub_stats.get("msgRateOut", 0),
                                        msg_throughput_out=sub_stats.get("msgThroughputOut", 0),
                                        consumer_count=len(sub_stats.get("consumers", [])),
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
                session.add_all(all_stats)
                await session.commit()
                collected = len(all_stats)

    finally:
        await client.close()

    return collected


async def _collect_broker_stats_async():
    """Async implementation of broker stats collection."""
    client, env_id = await _get_pulsar_client()
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
                    environment_id=env_id,
                    broker_url=broker_url,
                    msg_rate_in=stats.get("msgRateIn", 0),
                    msg_rate_out=stats.get("msgRateOut", 0),
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
                session.add_all(all_stats)
                await session.commit()
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
