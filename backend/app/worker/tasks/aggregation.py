"""Aggregation computation tasks."""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import and_, func, select

from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.models.stats import Aggregation, SubscriptionStats, TopicStats
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


async def _compute_aggregations_async():
    """Compute aggregations from latest topic and subscription stats."""
    async with async_session_factory() as session:
        # Get latest stats per topic using a subquery
        subq = (
            select(
                TopicStats.topic,
                func.max(TopicStats.collected_at).label("max_collected"),
            )
            .group_by(TopicStats.topic)
            .subquery()
        )

        # Join to get full stats for latest collection
        latest_stats = await session.execute(
            select(TopicStats)
            .join(
                subq,
                (TopicStats.topic == subq.c.topic)
                & (TopicStats.collected_at == subq.c.max_collected),
            )
        )
        stats_list = latest_stats.scalars().all()

        # Get latest subscription stats for backlog calculation
        sub_subq = (
            select(
                SubscriptionStats.topic,
                SubscriptionStats.subscription,
                func.max(SubscriptionStats.collected_at).label("max_collected"),
            )
            .group_by(SubscriptionStats.topic, SubscriptionStats.subscription)
            .subquery()
        )

        latest_sub_stats = await session.execute(
            select(SubscriptionStats)
            .join(
                sub_subq,
                and_(
                    SubscriptionStats.topic == sub_subq.c.topic,
                    SubscriptionStats.subscription == sub_subq.c.subscription,
                    SubscriptionStats.collected_at == sub_subq.c.max_collected,
                ),
            )
        )
        sub_stats_list = latest_sub_stats.scalars().all()

        # Build backlog map from subscription stats (tenant, namespace) -> total_backlog
        backlog_by_namespace = {}
        for sub_stat in sub_stats_list:
            key = (sub_stat.tenant, sub_stat.namespace)
            if key not in backlog_by_namespace:
                backlog_by_namespace[key] = 0
            backlog_by_namespace[key] += sub_stat.msg_backlog or 0

        # Aggregate by namespace
        namespace_aggs = {}
        for stat in stats_list:
            key = (stat.tenant, stat.namespace)
            if key not in namespace_aggs:
                namespace_aggs[key] = {
                    "topic_count": 0,
                    "total_msg_rate_in": 0,
                    "total_msg_rate_out": 0,
                    "total_backlog": 0,
                    "total_storage_size": 0,
                }
            agg = namespace_aggs[key]
            agg["topic_count"] += 1
            agg["total_msg_rate_in"] += stat.msg_rate_in or 0
            agg["total_msg_rate_out"] += stat.msg_rate_out or 0
            agg["total_storage_size"] += stat.storage_size or 0

        # Add backlog from subscription stats
        for key, backlog in backlog_by_namespace.items():
            if key in namespace_aggs:
                namespace_aggs[key]["total_backlog"] = backlog
            else:
                # Namespace has subscriptions but no topic stats yet
                namespace_aggs[key] = {
                    "topic_count": 0,
                    "total_msg_rate_in": 0,
                    "total_msg_rate_out": 0,
                    "total_backlog": backlog,
                    "total_storage_size": 0,
                }

        # Aggregate by tenant
        tenant_aggs = {}
        for (tenant, namespace), ns_agg in namespace_aggs.items():
            if tenant not in tenant_aggs:
                tenant_aggs[tenant] = {
                    "topic_count": 0,
                    "total_msg_rate_in": 0,
                    "total_msg_rate_out": 0,
                    "total_backlog": 0,
                    "total_storage_size": 0,
                }
            t_agg = tenant_aggs[tenant]
            t_agg["topic_count"] += ns_agg["topic_count"]
            t_agg["total_msg_rate_in"] += ns_agg["total_msg_rate_in"]
            t_agg["total_msg_rate_out"] += ns_agg["total_msg_rate_out"]
            t_agg["total_backlog"] += ns_agg["total_backlog"]
            t_agg["total_storage_size"] += ns_agg["total_storage_size"]

        # Upsert aggregations
        now = datetime.now(timezone.utc)
        count = 0

        # Namespace aggregations
        for (tenant, namespace), agg_data in namespace_aggs.items():
            # Check if exists
            result = await session.execute(
                select(Aggregation).where(
                    Aggregation.tenant == tenant,
                    Aggregation.namespace == namespace,
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.topic_count = agg_data["topic_count"]
                existing.total_msg_rate_in = agg_data["total_msg_rate_in"]
                existing.total_msg_rate_out = agg_data["total_msg_rate_out"]
                existing.total_backlog = agg_data["total_backlog"]
                existing.total_storage_size = agg_data["total_storage_size"]
                existing.computed_at = now
            else:
                agg = Aggregation(
                    tenant=tenant,
                    namespace=namespace,
                    topic_count=agg_data["topic_count"],
                    total_msg_rate_in=agg_data["total_msg_rate_in"],
                    total_msg_rate_out=agg_data["total_msg_rate_out"],
                    total_backlog=agg_data["total_backlog"],
                    total_storage_size=agg_data["total_storage_size"],
                    computed_at=now,
                )
                session.add(agg)
            count += 1

        # Tenant aggregations (namespace=None)
        for tenant, agg_data in tenant_aggs.items():
            result = await session.execute(
                select(Aggregation).where(
                    Aggregation.tenant == tenant,
                    Aggregation.namespace.is_(None),
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.topic_count = agg_data["topic_count"]
                existing.total_msg_rate_in = agg_data["total_msg_rate_in"]
                existing.total_msg_rate_out = agg_data["total_msg_rate_out"]
                existing.total_backlog = agg_data["total_backlog"]
                existing.total_storage_size = agg_data["total_storage_size"]
                existing.computed_at = now
            else:
                agg = Aggregation(
                    tenant=tenant,
                    namespace=None,
                    topic_count=agg_data["topic_count"],
                    total_msg_rate_in=agg_data["total_msg_rate_in"],
                    total_msg_rate_out=agg_data["total_msg_rate_out"],
                    total_backlog=agg_data["total_backlog"],
                    total_storage_size=agg_data["total_storage_size"],
                    computed_at=now,
                )
                session.add(agg)
            count += 1

        await session.commit()
        return count


@celery_app.task(bind=True, max_retries=3)
def compute_aggregations(self):
    """Compute tenant and namespace aggregations."""
    logger.info("Starting aggregation computation")
    try:
        count = run_async(_compute_aggregations_async())
        logger.info("Aggregation computation completed", aggregations=count)
        return {"aggregations": count}
    except Exception as e:
        logger.error("Aggregation computation failed", error=str(e))
        raise self.retry(exc=e, countdown=10 * (self.request.retries + 1))
