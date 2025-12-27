"""API v1 routes."""

from fastapi import APIRouter

from app.api.v1 import (
    audit,
    brokers,
    environment,
    messages,
    namespaces,
    notifications,
    subscriptions,
    tenants,
    topics,
)

router = APIRouter()

# Include all routers
router.include_router(environment.router)
router.include_router(tenants.router)
router.include_router(namespaces.router)
router.include_router(topics.router)
router.include_router(subscriptions.router)
router.include_router(messages.router)
router.include_router(brokers.router)
router.include_router(audit.router)
router.include_router(notifications.router)
