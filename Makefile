# =============================================================================
# Pulsar Manager - Development Makefile
# =============================================================================

.PHONY: help install dev-install lint format test run run-worker run-beat \
        docker-up docker-down docker-logs migrate migrate-create clean

# Default target
help:
	@echo "Pulsar Manager Development Commands"
	@echo "===================================="
	@echo ""
	@echo "Setup:"
	@echo "  install        Install production dependencies"
	@echo "  dev-install    Install development dependencies"
	@echo ""
	@echo "Development:"
	@echo "  run            Run the FastAPI development server"
	@echo "  run-worker     Run Celery worker"
	@echo "  run-beat       Run Celery beat scheduler"
	@echo "  run-frontend   Run the React development server"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint           Run linting checks"
	@echo "  format         Format code"
	@echo "  test           Run tests"
	@echo "  test-cov       Run tests with coverage"
	@echo ""
	@echo "Database:"
	@echo "  migrate        Run database migrations"
	@echo "  migrate-create Create new migration"
	@echo ""
	@echo "Docker:"
	@echo "  docker-up      Start infrastructure services"
	@echo "  docker-down    Stop infrastructure services"
	@echo "  docker-logs    Show service logs"
	@echo "  docker-full    Start all services including app"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean          Clean generated files"

# =============================================================================
# Setup
# =============================================================================

install:
	cd backend && pip install .

dev-install:
	cd backend && pip install -e ".[dev]"

# =============================================================================
# Development
# =============================================================================

run:
	cd backend && uvicorn app.main:app --reload --port 8000

run-worker:
	cd backend && celery -A app.worker.celery_app worker --loglevel=info

run-beat:
	cd backend && celery -A app.worker.celery_app beat --loglevel=info

run-frontend:
	npm run dev

# =============================================================================
# Code Quality
# =============================================================================

lint:
	cd backend && ruff check .
	cd backend && mypy app/

format:
	cd backend && ruff format .
	cd backend && ruff check --fix .

test:
	cd backend && pytest

test-cov:
	cd backend && pytest --cov=app --cov-report=html --cov-report=term

# =============================================================================
# Database
# =============================================================================

migrate:
	cd backend && alembic upgrade head

migrate-create:
	@read -p "Migration message: " msg; \
	cd backend && alembic revision --autogenerate -m "$$msg"

migrate-down:
	cd backend && alembic downgrade -1

# =============================================================================
# Docker
# =============================================================================

docker-up:
	docker compose up -d postgres redis pulsar

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-full:
	docker compose --profile full up -d

docker-clean:
	docker compose down -v --remove-orphans

# =============================================================================
# Cleanup
# =============================================================================

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name ".coverage" -delete 2>/dev/null || true
