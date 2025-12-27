"""Pulsar Manager API - FastAPI Application."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from app.config import settings
from app.core.database import close_db, init_db
from app.core.logging import get_logger, setup_logging
from app.core.redis import close_redis, init_redis
from app.middleware import ErrorHandlerMiddleware, RequestLoggingMiddleware

# Import routers (legacy - will be replaced with new API structure)
from app.routers import clusters, namespaces, tenants, topics

# Import new API v1 router
from app.api.v1 import router as api_v1_router

# Set up logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info(
        "Starting Pulsar Manager API",
        app_name=settings.app_name,
        environment=settings.app_env,
        debug=settings.debug,
    )

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

    # Initialize Redis
    try:
        await init_redis()
        logger.info("Redis initialized")
    except Exception as e:
        logger.warning("Failed to initialize Redis, continuing without cache", error=str(e))

    yield

    # Shutdown
    logger.info("Shutting down Pulsar Manager API")
    await close_db()
    await close_redis()


# Create FastAPI application
app = FastAPI(
    title="Pulsar Manager API",
    description="Modern management and monitoring API for Apache Pulsar",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Add middleware (order matters - first added is outermost)
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Prometheus metrics endpoint
if settings.metrics_enabled:
    metrics_app = make_asgi_app()
    app.mount(settings.metrics_path, metrics_app)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": "0.1.0",
    }


# Ready check endpoint (includes dependency checks)
@app.get("/ready", tags=["health"])
async def ready_check() -> dict:
    """Readiness check endpoint with dependency verification."""
    checks = {
        "database": False,
        "redis": False,
        "pulsar": False,
    }

    # Check database
    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = True
    except Exception as e:
        logger.warning("Database health check failed", error=str(e))

    # Check Redis
    try:
        from app.core.redis import get_redis_context

        async with get_redis_context() as redis:
            await redis.ping()
            checks["redis"] = True
    except Exception as e:
        logger.warning("Redis health check failed", error=str(e))

    # Check Pulsar (basic connectivity)
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.pulsar_admin_url}/admin/v2/clusters")
            if response.status_code == 200:
                checks["pulsar"] = True
    except Exception as e:
        logger.warning("Pulsar health check failed", error=str(e))

    all_healthy = all(checks.values())
    status = "ready" if all_healthy else "degraded"

    return {
        "status": status,
        "checks": checks,
    }


# Root endpoint
@app.get("/", tags=["root"])
async def root() -> dict:
    """Root endpoint."""
    return {
        "message": "Pulsar Manager API",
        "version": "0.1.0",
        "docs": "/docs" if settings.debug else None,
    }


# Include legacy routers (will be migrated to /api/v1)
app.include_router(
    tenants.router,
    prefix="/pulsar-manager/admin/v2",
    tags=["tenants (legacy)"],
)
app.include_router(
    clusters.router,
    prefix="/pulsar-manager/admin/v2",
    tags=["clusters (legacy)"],
)
app.include_router(
    namespaces.router,
    prefix="/pulsar-manager/admin/v2",
    tags=["namespaces (legacy)"],
)
app.include_router(
    topics.router,
    prefix="/pulsar-manager/admin/v2",
    tags=["topics (legacy)"],
)

# New API v1 routers
app.include_router(api_v1_router, prefix="/api/v1")
