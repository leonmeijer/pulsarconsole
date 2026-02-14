#!/bin/bash
# Pulsar Console Development Runner
# Script to build and run the development environment
#
# Usage:
#   ./run-docker-dev.sh build        - Build all images
#   ./run-docker-dev.sh start        - Start infrastructure (postgres, redis)
#   ./run-docker-dev.sh start full   - Start infrastructure + app (api, worker, beat, frontend)
#   ./run-docker-dev.sh stop         - Stop all containers
#   ./run-docker-dev.sh logs         - Follow logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Usage: ./run-docker-dev.sh [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${GREEN}Build Commands:${NC}"
    echo "  build              Build all Docker images"
    echo "  build-backend      Build backend image only"
    echo "  build-frontend     Build frontend image only"
    echo ""
    echo -e "${GREEN}Start Commands:${NC}"
    echo "  start              Start infrastructure (postgres, redis)"
    echo "  start full         Start infrastructure + full app stack"
    echo "  start api          Start infrastructure + API only"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo "  shell              Enter API container shell"
    echo "  migrate            Run database migrations"
    echo "  logs [service]     Follow logs (default: all)"
    echo "  ps                 Show running containers"
    echo "  stop               Stop all containers"
    echo "  clean              Stop and remove containers, volumes"
    echo "  reset-db           Drop and recreate the database"
    echo ""
    echo -e "${YELLOW}Testing & Quality:${NC}"
    echo "  test               Run pytest"
    echo "  lint               Run linters"
    echo "  format             Auto-format code"
    echo ""
    echo -e "${BLUE}Services:${NC}"
    echo "  postgres, redis        - Infrastructure (local)"
    echo "  api, worker, beat      - Backend services"
    echo "  frontend               - React frontend"
    echo ""
    echo -e "${YELLOW}Note:${NC} Pulsar is configured externally via .env"
    echo ""
    echo "Examples:"
    echo "  ./run-docker-dev.sh build            # Build all images"
    echo "  ./run-docker-dev.sh start            # Start infrastructure only"
    echo "  ./run-docker-dev.sh start full       # Start everything"
    echo "  ./run-docker-dev.sh logs api         # View API logs"
    echo "  ./run-docker-dev.sh migrate          # Run migrations"
    echo ""
}

# ============================================================================
# BUILD COMMANDS
# ============================================================================

build_all() {
    echo -e "${GREEN}Building all Docker images...${NC}"
    docker compose --profile full build
    echo -e "${GREEN}All images built successfully!${NC}"
}

build_backend() {
    echo -e "${GREEN}Building backend image...${NC}"
    docker compose build api worker beat migrate
}

build_frontend() {
    echo -e "${GREEN}Building frontend image...${NC}"
    docker compose --profile full build frontend
}

# ============================================================================
# START COMMANDS
# ============================================================================

start_infra() {
    echo -e "${GREEN}Starting infrastructure (postgres, redis)...${NC}"
    docker compose up -d postgres redis

    echo ""
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

    # Wait for postgres
    echo -n "Waiting for PostgreSQL..."
    until docker compose exec -T postgres pg_isready -U pulsar -d pulsar_console > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}ready${NC}"

    # Wait for redis
    echo -n "Waiting for Redis..."
    until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}ready${NC}"

    echo ""
    echo -e "${GREEN}Infrastructure started!${NC}"
    echo ""
    echo -e "${BLUE}Services running:${NC}"
    echo "  PostgreSQL: localhost:5434"
    echo "  Redis:      localhost:6379"
    echo ""
}

start_full() {
    start_infra

    echo -e "${GREEN}Starting full application stack...${NC}"
    docker compose --profile full up -d

    echo ""
    echo -e "${GREEN}Full stack started!${NC}"
    echo ""
    echo -e "${BLUE}Application URLs:${NC}"
    echo "  Frontend:  http://localhost:3000"
    echo "  API:       http://localhost:8001"
    echo "  API Docs:  http://localhost:8001/docs"
    echo ""
    echo -e "${YELLOW}To view logs: ${NC}./run-docker-dev.sh logs"
    echo -e "${YELLOW}To stop: ${NC}./run-docker-dev.sh stop"
}

start_api() {
    start_infra

    echo -e "${GREEN}Starting API service...${NC}"
    docker compose --profile full up -d migrate
    docker compose --profile full up -d api

    echo ""
    echo -e "${GREEN}API started!${NC}"
    echo ""
    echo -e "${BLUE}API URLs:${NC}"
    echo "  API:      http://localhost:8001"
    echo "  API Docs: http://localhost:8001/docs"
    echo ""
}

start_stack() {
    local target=${1:-}

    if [ "$target" = "full" ]; then
        start_full
    elif [ "$target" = "api" ]; then
        start_api
    else
        start_infra
    fi
}

# ============================================================================
# MANAGEMENT COMMANDS
# ============================================================================

enter_shell() {
    echo -e "${GREEN}Entering API container shell...${NC}"
    docker compose exec api bash
}

run_migrate() {
    echo -e "${GREEN}Running database migrations...${NC}"
    docker compose up -d postgres
    echo -e "${YELLOW}Waiting for postgres to be ready...${NC}"
    sleep 3
    docker compose --profile full run --rm migrate
    echo -e "${GREEN}Migrations complete!${NC}"
}

show_logs() {
    local service=${1:-}
    echo -e "${GREEN}Following logs (Ctrl+C to exit)...${NC}"
    if [ -n "$service" ]; then
        docker compose logs -f "$service"
    else
        docker compose --profile full logs -f
    fi
}

show_ps() {
    docker compose --profile full ps
}

stop_stack() {
    echo -e "${YELLOW}Stopping all containers...${NC}"
    docker compose --profile full down
}

clean_all() {
    echo -e "${RED}Stopping and removing containers, volumes...${NC}"
    docker compose --profile full down -v
}

reset_db() {
    echo -e "${YELLOW}Resetting database...${NC}"
    docker compose exec -T postgres dropdb -U pulsar --if-exists pulsar_console
    docker compose exec -T postgres createdb -U pulsar pulsar_console
    echo -e "${GREEN}Database reset! Run migrations:${NC} ./run-docker-dev.sh migrate"
}

# ============================================================================
# TESTING & QUALITY COMMANDS
# ============================================================================

run_tests() {
    echo -e "${GREEN}Running tests...${NC}"
    docker compose --profile full run --rm api pytest tests/ -v
}

run_lint() {
    echo -e "${GREEN}Running linters...${NC}"
    docker compose --profile full run --rm api bash -c "
        echo 'Running ruff check...' && ruff check app/ &&
        echo 'Running ruff format check...' && ruff format --check app/
    "
}

run_format() {
    echo -e "${GREEN}Formatting code...${NC}"
    docker compose --profile full run --rm api bash -c "
        ruff check --fix app/ &&
        ruff format app/
    "
    echo -e "${GREEN}Code formatted!${NC}"
}

# ============================================================================
# MAIN COMMAND HANDLER
# ============================================================================

case "${1:-help}" in
    # Build commands
    build)
        build_all
        ;;
    build-backend)
        build_backend
        ;;
    build-frontend)
        build_frontend
        ;;

    # Start commands
    start)
        start_stack "$2"
        ;;

    # Management commands
    shell)
        enter_shell
        ;;
    migrate)
        run_migrate
        ;;
    logs)
        show_logs "$2"
        ;;
    ps)
        show_ps
        ;;
    stop)
        stop_stack
        ;;
    clean)
        clean_all
        ;;
    reset-db)
        reset_db
        ;;

    # Testing & quality
    test)
        run_tests
        ;;
    lint)
        run_lint
        ;;
    format)
        run_format
        ;;

    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
