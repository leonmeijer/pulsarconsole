"""Celery application configuration."""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

# Create Celery app
celery_app = Celery(
    "pulsar_manager",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.worker.tasks.stats_collection",
        "app.worker.tasks.aggregation",
        "app.worker.tasks.cleanup",
    ],
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=5,
    task_max_retries=3,

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,

    # Result settings
    result_expires=3600,

    # Beat schedule for periodic tasks
    beat_schedule={
        "collect-topic-stats": {
            "task": "app.worker.tasks.stats_collection.collect_topic_stats",
            "schedule": settings.stats_collection_interval,
        },
        "collect-subscription-stats": {
            "task": "app.worker.tasks.stats_collection.collect_subscription_stats",
            "schedule": settings.stats_collection_interval,
        },
        "collect-broker-stats": {
            "task": "app.worker.tasks.stats_collection.collect_broker_stats",
            "schedule": settings.broker_stats_interval,
        },
        "compute-aggregations": {
            "task": "app.worker.tasks.aggregation.compute_aggregations",
            "schedule": settings.aggregation_interval,
        },
        "cleanup-old-stats": {
            "task": "app.worker.tasks.cleanup.cleanup_old_stats",
            "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
        },
        "cleanup-old-audit": {
            "task": "app.worker.tasks.cleanup.cleanup_old_audit",
            "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM
        },
    },
)
