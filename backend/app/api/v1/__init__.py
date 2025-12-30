"""API v1 routes."""

from fastapi import APIRouter

from app.api.v1 import (
    audit,
    auth,
    brokers,
    environment,
    messages,
    namespaces,
    notifications,
    pulsar_auth,
    rbac,
    search,
    subscriptions,
    tenants,
    tokens,
    topics,
    ws,
)

router = APIRouter()

# Include all routers
router.include_router(ws.router)  # WebSocket endpoint
router.include_router(auth.router)  # Auth endpoints first
router.include_router(tokens.router)  # Token management
router.include_router(rbac.router)  # RBAC endpoints
router.include_router(environment.router)
router.include_router(tenants.router)
router.include_router(namespaces.router)
router.include_router(topics.router)
router.include_router(subscriptions.router)
router.include_router(messages.router)
router.include_router(brokers.router)
router.include_router(audit.router)
router.include_router(notifications.router)
router.include_router(pulsar_auth.router)
router.include_router(search.router)
