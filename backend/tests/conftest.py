"""Pytest configuration and fixtures."""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, Text, event
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings
from app.core.database import Base, get_db
from app.main import app


# SQLite doesn't support JSONB, so we need to replace it with JSON for tests
# This is done by listening to the before_create event
@event.listens_for(Base.metadata, "before_create")
def _replace_pg_types_for_sqlite(target, connection, **kw):
    """Replace PostgreSQL-specific types with SQLite-compatible ones."""
    if connection.dialect.name == "sqlite":
        for table in target.tables.values():
            for column in table.columns:
                if isinstance(column.type, JSONB):
                    column.type = JSON()
                elif isinstance(column.type, ARRAY):
                    # Store arrays as JSON in SQLite
                    column.type = JSON()


# Test settings
@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Get test settings with test database."""
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        redis_url="redis://localhost:6379/15",  # Use DB 15 for tests
        pulsar_admin_url="http://localhost:8080",
        debug=True,
        log_level="DEBUG",
    )


# Event loop for async tests
@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Test database engine
@pytest_asyncio.fixture(scope="function")
async def test_engine(test_settings: Settings):
    """Create test database engine."""
    engine = create_async_engine(
        test_settings.database_url,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


# Test database session
@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session


# Test client (sync)
@pytest.fixture(scope="function")
def client(db_session: AsyncSession) -> Generator[TestClient, None, None]:
    """Create sync test client."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# Test client (async)
@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# Sample data fixtures
@pytest.fixture
def sample_tenant_data() -> dict[str, Any]:
    """Sample tenant data for testing."""
    return {
        "name": "test-tenant",
        "admin_roles": ["admin"],
        "allowed_clusters": ["standalone"],
    }


@pytest.fixture
def sample_namespace_data() -> dict[str, Any]:
    """Sample namespace data for testing."""
    return {
        "tenant": "test-tenant",
        "namespace": "test-namespace",
        "policies": {
            "retention_time_minutes": 60,
            "retention_size_mb": 1024,
        },
    }


@pytest.fixture
def sample_topic_data() -> dict[str, Any]:
    """Sample topic data for testing."""
    return {
        "topic": "persistent://test-tenant/test-namespace/test-topic",
        "partition_count": 4,
    }
