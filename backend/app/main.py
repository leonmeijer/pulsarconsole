"""Pulsar Console API - FastAPI Application."""

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
        "Starting Pulsar Console API",
        app_name=settings.app_name,
        environment=settings.app_env,
        debug=settings.debug,
        oidc_enabled=settings.oidc_enabled,
        oidc_issuer=settings.oidc_issuer_url,
        oidc_client_id=settings.oidc_client_id,
    )

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

    # Auto-provision default environment from env variables if none exist
    if settings.pulsar_auto_provision:
        try:
            from app.core.database import async_session_factory
            from app.services.environment import EnvironmentService
            from app.models.environment import AuthMode

            async with async_session_factory() as session:
                env_service = EnvironmentService(session)
                existing = await env_service.get_all_environments()

                if not existing:
                    # Determine auth mode based on token presence
                    auth_mode = AuthMode.token if settings.pulsar_auth_token else AuthMode.none

                    # Create default environment from settings
                    env_name = settings.pulsar_cluster or "default"
                    logger.info(
                        "Auto-provisioning default environment from settings",
                        name=env_name,
                        admin_url=settings.pulsar_admin_url,
                        auth_mode=auth_mode.value,
                    )

                    await env_service.create_environment(
                        name=env_name,
                        admin_url=settings.pulsar_admin_url,
                        auth_mode=auth_mode,
                        token=settings.pulsar_auth_token,
                        validate_connectivity=False,  # Don't block startup on connectivity
                        is_shared=True,
                        created_by_id=None,  # System-created
                    )
                    await session.commit()
                    logger.info("Default environment created successfully", name=env_name)
                else:
                    logger.debug("Environments already exist, skipping auto-provision")
        except Exception as e:
            logger.warning("Failed to auto-provision default environment", error=str(e))

    # Seed default permissions and roles
    try:
        from app.core.database import async_session_factory
        from app.services.seed import SeedService

        async with async_session_factory() as session:
            seed_service = SeedService(session)
            await seed_service.seed_all_environments()
            await session.commit()
        # Log message is now handled within seed_all_environments for better accuracy
    except Exception as e:
        logger.warning("Failed to initialize seed data", error=str(e))

    # Initialize Redis
    try:
        await init_redis()
        logger.info("Redis initialized")
    except Exception as e:
        logger.warning("Failed to initialize Redis, continuing without cache", error=str(e))

    yield

    # Shutdown
    logger.info("Shutting down Pulsar Console API")
    await close_db()
    await close_redis()


# Create FastAPI application
app = FastAPI(
    title="Pulsar Console API",
    description="Modern management and monitoring API for Apache Pulsar",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Add middleware (order matters - first added is outermost)
if settings.elastic_apm_enabled:
    try:
        from elasticapm.contrib.starlette import ElasticAPM
        from elasticapm.base import Client
        
        apm_client = Client({
            'SERVICE_NAME': settings.elastic_apm_service_name,
            'SERVER_URL': settings.elastic_apm_server_url,
            'SECRET_TOKEN': settings.elastic_apm_secret_token,
            'ENVIRONMENT': settings.app_env,
        })
        app.add_middleware(ElasticAPM, client=apm_client)
        logger.info("Elastic APM middleware enabled")
    except ImportError:
        logger.warning("elastic-apm not installed, skipping APM middleware")

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
        "message": "Pulsar Console API",
        "version": "0.1.0",
        "docs": "/docs" if settings.debug else None,
    }


# New API v1 routers
app.include_router(api_v1_router, prefix="/api/v1")
