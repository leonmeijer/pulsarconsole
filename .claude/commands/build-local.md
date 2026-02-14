---
description: Build and run the app locally with Docker
---

# Local Development Build

## Quick Start

```bash
# Build all images
./run-docker-dev.sh build

# Start full stack (postgres, redis, api, worker, beat, frontend)
./run-docker-dev.sh start full
```

## Build Commands

```bash
./run-docker-dev.sh build            # Build all images
./run-docker-dev.sh build-backend    # Build backend only
./run-docker-dev.sh build-frontend   # Build frontend only
```

## Start Commands

```bash
./run-docker-dev.sh start            # Infrastructure only (postgres, redis)
./run-docker-dev.sh start full       # Full stack
./run-docker-dev.sh start api        # Infrastructure + API only
```

## Management Commands

```bash
./run-docker-dev.sh migrate          # Run database migrations
./run-docker-dev.sh logs             # Follow all logs
./run-docker-dev.sh logs api         # Follow API logs only
./run-docker-dev.sh ps               # Show running containers
./run-docker-dev.sh shell            # Enter API container shell
./run-docker-dev.sh stop             # Stop all containers
./run-docker-dev.sh clean            # Stop and remove volumes
```

## Testing & Quality

```bash
./run-docker-dev.sh test             # Run pytest
./run-docker-dev.sh lint             # Run linters
./run-docker-dev.sh format           # Auto-format code
```

## URLs (when running full stack)

- Frontend: http://localhost:3000
- API: http://localhost:8001
- API Docs: http://localhost:8001/docs
- PostgreSQL: localhost:5434
- Redis: localhost:6379

## Notes

- Pulsar connection is configured via `.env` file
- Infrastructure (postgres, redis) runs locally in Docker
- The full stack includes: api, worker, beat, frontend
