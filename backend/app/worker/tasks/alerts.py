"""Alert checking tasks for generating notifications."""

import asyncio
from celery import shared_task

from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.services.environment import EnvironmentService
from app.services.notification import NotificationService
from app.models.notification import NotificationType, NotificationSeverity

logger = get_logger(__name__)


async def _check_consumer_disconnects() -> int:
    """Check for subscriptions with no consumers."""
    count = 0
    async with async_session_factory() as session:
        try:
            env_service = EnvironmentService(session)
            pulsar = await env_service.get_pulsar_client()
            notification_service = NotificationService(session, pulsar)

            # Get all tenants
            tenants = await pulsar.get_tenants()

            for tenant in tenants:
                try:
                    namespaces = await pulsar.get_namespaces(tenant)
                    for ns in namespaces:
                        ns_name = ns.split("/")[-1] if "/" in ns else ns

                        try:
                            # get_topics returns list of topic names like "persistent://public/default/test"
                            topics = await pulsar.get_topics(tenant, ns_name)

                            for topic_full in topics:
                                try:
                                    # Get topic stats to check subscriptions
                                    stats = await pulsar.get_topic_stats(topic_full)
                                    subscriptions = stats.get("subscriptions", {})

                                    for sub_name, sub_stats in subscriptions.items():
                                        consumer_count = len(sub_stats.get("consumers", []))
                                        backlog = sub_stats.get("msgBacklog", 0)
                                        is_durable = sub_stats.get("isDurable", True)

                                        # Only alert for durable subscriptions with no consumers and backlog
                                        if is_durable and consumer_count == 0 and backlog > 0:
                                            # Determine severity based on backlog
                                            if backlog > 10000:
                                                severity = NotificationSeverity.CRITICAL
                                            elif backlog > 1000:
                                                severity = NotificationSeverity.WARNING
                                            else:
                                                severity = NotificationSeverity.INFO

                                            topic_short = topic_full.split("/")[-1]
                                            notification = await notification_service.create_notification(
                                                type=NotificationType.CONSUMER_DISCONNECT,
                                                severity=severity,
                                                title=f"No consumers on {sub_name}",
                                                message=f"Subscription '{sub_name}' on topic '{topic_short}' "
                                                        f"has no active consumers. Backlog: {backlog:,} messages.",
                                                resource_type="subscription",
                                                resource_id=f"{topic_full}/{sub_name}",
                                                extra_data={
                                                    "topic": topic_full,
                                                    "subscription": sub_name,
                                                    "backlog": backlog,
                                                },
                                            )
                                            if notification:
                                                count += 1

                                except Exception as e:
                                    logger.debug("Failed to check topic stats", topic=topic_full, error=str(e))

                        except Exception as e:
                            logger.debug("Failed to get topics", tenant=tenant, namespace=ns_name, error=str(e))

                except Exception as e:
                    logger.debug("Failed to get namespaces", tenant=tenant, error=str(e))

            await session.commit()
            await pulsar.close()

        except Exception as e:
            logger.error("Failed to check consumer disconnects", error=str(e))
            await session.rollback()

    return count


async def _check_broker_health() -> int:
    """Check broker health status."""
    count = 0
    async with async_session_factory() as session:
        try:
            env_service = EnvironmentService(session)
            pulsar = await env_service.get_pulsar_client()
            notification_service = NotificationService(session, pulsar)

            # Get clusters and check their broker URLs
            clusters = await pulsar.get_clusters()

            for cluster_name in clusters:
                try:
                    cluster_info = await pulsar.get_cluster(cluster_name)
                    broker_url = cluster_info.get("brokerServiceUrl", "")

                    if not broker_url:
                        continue

                    # Try to verify the cluster is responsive by checking if we can get tenant info
                    # If the main API is working, we assume the cluster is healthy
                    # A more sophisticated check would ping the broker directly

                except Exception as e:
                    # Cluster/broker unreachable
                    notification = await notification_service.create_notification(
                        type=NotificationType.BROKER_HEALTH,
                        severity=NotificationSeverity.CRITICAL,
                        title=f"Cluster unreachable: {cluster_name}",
                        message=f"Cluster '{cluster_name}' is not responding: {str(e)}",
                        resource_type="broker",
                        resource_id=cluster_name,
                        extra_data={"cluster": cluster_name, "error": str(e)},
                    )
                    if notification:
                        count += 1

            await session.commit()
            await pulsar.close()

        except Exception as e:
            logger.error("Failed to check broker health", error=str(e))
            await session.rollback()

    return count


async def _check_storage_warnings() -> int:
    """Check for topics with high storage usage."""
    count = 0
    async with async_session_factory() as session:
        try:
            env_service = EnvironmentService(session)
            pulsar = await env_service.get_pulsar_client()
            notification_service = NotificationService(session, pulsar)

            # Get all tenants
            tenants = await pulsar.get_tenants()

            for tenant in tenants:
                try:
                    namespaces = await pulsar.get_namespaces(tenant)
                    for ns in namespaces:
                        ns_name = ns.split("/")[-1] if "/" in ns else ns

                        try:
                            topics = await pulsar.get_topics(tenant, ns_name)

                            for topic_full in topics:
                                try:
                                    stats = await pulsar.get_topic_stats(topic_full)
                                    storage_bytes = stats.get("storageSize", 0)
                                    storage_mb = storage_bytes / (1024 * 1024)

                                    # Check storage thresholds
                                    if storage_mb >= 500:
                                        severity = NotificationSeverity.CRITICAL
                                    elif storage_mb >= 100:
                                        severity = NotificationSeverity.WARNING
                                    else:
                                        continue

                                    topic_short = topic_full.split("/")[-1]
                                    notification = await notification_service.create_notification(
                                        type=NotificationType.STORAGE_WARNING,
                                        severity=severity,
                                        title=f"High storage: {topic_short}",
                                        message=f"Topic '{topic_short}' is using {storage_mb:.1f} MB of storage.",
                                        resource_type="topic",
                                        resource_id=topic_full,
                                        extra_data={
                                            "topic": topic_full,
                                            "storage_mb": round(storage_mb, 2),
                                            "storage_bytes": storage_bytes,
                                        },
                                    )
                                    if notification:
                                        count += 1

                                except Exception as e:
                                    logger.debug("Failed to get topic stats", topic=topic_full, error=str(e))

                        except Exception as e:
                            logger.debug("Failed to get topics", tenant=tenant, namespace=ns_name, error=str(e))

                except Exception as e:
                    logger.debug("Failed to get namespaces", tenant=tenant, error=str(e))

            await session.commit()
            await pulsar.close()

        except Exception as e:
            logger.error("Failed to check storage warnings", error=str(e))
            await session.rollback()

    return count


@shared_task(name="check_alerts")
def check_alerts() -> dict:
    """Run all alert checks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        consumer_count = loop.run_until_complete(_check_consumer_disconnects())
        broker_count = loop.run_until_complete(_check_broker_health())
        storage_count = loop.run_until_complete(_check_storage_warnings())

        total = consumer_count + broker_count + storage_count

        logger.info(
            "Alert check completed",
            consumer_disconnects=consumer_count,
            broker_health=broker_count,
            storage_warnings=storage_count,
            total=total,
        )

        return {
            "consumer_disconnects": consumer_count,
            "broker_health": broker_count,
            "storage_warnings": storage_count,
            "total": total,
        }

    finally:
        loop.close()


@shared_task(name="cleanup_old_notifications")
def cleanup_old_notifications(days: int = 30) -> int:
    """Clean up old notifications."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        async def _cleanup():
            async with async_session_factory() as session:
                notification_service = NotificationService(session)
                count = await notification_service.cleanup_old_notifications(days)
                await session.commit()
                return count

        count = loop.run_until_complete(_cleanup())
        logger.info("Cleaned up old notifications", count=count, days=days)
        return count

    finally:
        loop.close()
