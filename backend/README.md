# Pulsar Manager API

Modern FastAPI backend for Apache Pulsar Manager.

## Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL 16+
- Redis 7+
- Apache Pulsar 3.x

### Development Setup

1. **Start infrastructure services:**

```bash
# From project root
docker compose up -d postgres redis pulsar
```

2. **Create virtual environment:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. **Install dependencies:**

```bash
pip install -e ".[dev]"
```

4. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your settings
```

5. **Run database migrations:**

```bash
alembic upgrade head
```

6. **Start the API server:**

```bash
uvicorn app.main:app --reload --port 8000
```

7. **Start Celery worker (separate terminal):**

```bash
celery -A app.worker.celery_app worker --loglevel=info
```

8. **Start Celery beat scheduler (separate terminal):**

```bash
celery -A app.worker.celery_app beat --loglevel=info
```

### API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration management
│   │
│   ├── api/                 # API routes
│   │   ├── __init__.py
│   │   ├── deps.py          # Dependency injection
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── environment.py
│   │       ├── tenants.py
│   │       ├── namespaces.py
│   │       ├── topics.py
│   │       ├── subscriptions.py
│   │       ├── brokers.py
│   │       ├── messages.py
│   │       └── audit.py
│   │
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── environment.py
│   │   ├── audit.py
│   │   └── stats.py
│   │
│   ├── schemas/             # Pydantic models
│   │   ├── __init__.py
│   │   ├── common.py
│   │   ├── environment.py
│   │   ├── tenant.py
│   │   ├── namespace.py
│   │   ├── topic.py
│   │   ├── subscription.py
│   │   ├── broker.py
│   │   └── audit.py
│   │
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── pulsar_admin.py  # Pulsar Admin API client
│   │   ├── cache.py         # Redis cache service
│   │   ├── environment.py
│   │   ├── tenant.py
│   │   ├── namespace.py
│   │   ├── topic.py
│   │   ├── subscription.py
│   │   ├── broker.py
│   │   ├── message_browser.py
│   │   └── audit.py
│   │
│   ├── repositories/        # Data access layer
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── environment.py
│   │   ├── audit.py
│   │   ├── stats.py
│   │   └── aggregation.py
│   │
│   ├── worker/              # Celery tasks
│   │   ├── __init__.py
│   │   ├── celery_app.py
│   │   └── tasks/
│   │       ├── __init__.py
│   │       ├── stats_collection.py
│   │       ├── aggregation.py
│   │       └── cleanup.py
│   │
│   ├── core/                # Core utilities
│   │   ├── __init__.py
│   │   ├── database.py      # Database connection
│   │   ├── redis.py         # Redis connection
│   │   ├── security.py      # Encryption utilities
│   │   ├── logging.py       # Structured logging
│   │   └── exceptions.py    # Custom exceptions
│   │
│   └── middleware/          # FastAPI middleware
│       ├── __init__.py
│       ├── logging.py
│       └── error_handler.py
│
├── alembic/                 # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│
├── tests/                   # Test suite
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── property/
│
├── pyproject.toml           # Project configuration
├── alembic.ini              # Alembic configuration
├── Dockerfile
├── .env.example
└── README.md
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run property tests only
pytest tests/property/

# Run specific test file
pytest tests/unit/test_tenant_service.py
```

## Code Quality

```bash
# Format code
ruff format .

# Lint code
ruff check .

# Type checking
mypy app/
```

## License

Apache License 2.0
