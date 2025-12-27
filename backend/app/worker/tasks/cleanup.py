"""Cleanup tasks for old data."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.config import settings
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.models.audit import AuditEvent
from app.models.stats import BrokerStats, SubscriptionStats, TopicStats
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


async def _cleanup_old_stats_async(retention_days: int = 7):
    """Delete statistics older than retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = {"topic_stats": 0, "subscription_stats": 0, "broker_stats": 0}

    async with async_session_factory() as session:
        # Delete old topic stats
        result = await session.execute(
            delete(TopicStats).where(TopicStats.collected_at < cutoff)
        )
        deleted["topic_stats"] = result.rowcount

        # Delete old subscription stats
        result = await session.execute(
            delete(SubscriptionStats).where(SubscriptionStats.collected_at < cutoff)
        )
        deleted["subscription_stats"] = result.rowcount

        # Delete old broker stats
        result = await session.execute(
            delete(BrokerStats).where(BrokerStats.collected_at < cutoff)
        )
        deleted["broker_stats"] = result.rowcount

        await session.commit()

    return deleted


async def _cleanup_old_audit_async(retention_days: int = 90):
    """Delete audit events older than retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    async with async_session_factory() as session:
        result = await session.execute(
            delete(AuditEvent).where(AuditEvent.timestamp < cutoff)
        )
        deleted = result.rowcount
        await session.commit()

    return deleted


@celery_app.task(bind=True, max_retries=3)
def cleanup_old_stats(self):
    """Clean up statistics older than retention period."""
    logger.info("Starting old stats cleanup")
    try:
        retention_days = getattr(settings, "stats_retention_days", 7)
        deleted = run_async(_cleanup_old_stats_async(retention_days))
        logger.info(
            "Old stats cleanup completed",
            topic_stats=deleted["topic_stats"],
            subscription_stats=deleted["subscription_stats"],
            broker_stats=deleted["broker_stats"],
        )
        return deleted
    except Exception as e:
        logger.error("Old stats cleanup failed", error=str(e))
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))


@celery_app.task(bind=True, max_retries=3)
def cleanup_old_audit(self):
    """Clean up audit events older than retention period."""
    logger.info("Starting old audit cleanup")
    try:
        retention_days = getattr(settings, "audit_retention_days", 90)
        deleted = run_async(_cleanup_old_audit_async(retention_days))
        logger.info("Old audit cleanup completed", deleted=deleted)
        return {"deleted": deleted}
    except Exception as e:
        logger.error("Old audit cleanup failed", error=str(e))
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
