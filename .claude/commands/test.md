---
description: Run linting and tests for the project
---

# Testing Procedure

## Quick Test (using Docker dev script)

```bash
./run-docker-dev.sh lint      # Run linters
./run-docker-dev.sh test      # Run pytest
./run-docker-dev.sh format    # Auto-format code
```

## Backend Tests (direct)

```bash
cd backend
poetry run pytest                    # Run all tests
poetry run pytest -v                 # Verbose output
poetry run pytest --cov=app          # With coverage
poetry run ruff check .              # Lint check
poetry run ruff format .             # Format code
```

## Frontend Tests (direct)

```bash
npm run lint                         # ESLint
npx tsc --noEmit                     # TypeScript check
npm run test:run                     # Run tests (single run)
npm run test                         # Run tests (watch mode)
```
