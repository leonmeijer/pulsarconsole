# CLAUDE.md

Web management console for Apache Pulsar.

## Stack

- **Frontend** (`/`): React 19, Vite, TypeScript, Tailwind 4, Radix UI, TanStack Query, Vitest
- **Backend** (`/backend`): FastAPI, SQLAlchemy (async + Postgres), Redis, Celery, Alembic

## Commands

```bash
# Use Makefile — run `make help` for full list
make dev-install    # backend deps
npm install         # frontend deps
make run            # backend (port 8000)
make run-frontend   # frontend (Vite dev server)
make docker-up      # postgres, redis, pulsar
make test           # backend tests (pytest)
npm run test:run    # frontend tests (vitest)
make lint           # ruff + mypy
npm run lint        # eslint
make format         # ruff format + fix
make migrate        # alembic upgrade head
```

## Code Style

- **Python**: ruff (line-length 100), mypy strict, isort via ruff
- **TypeScript**: eslint, strict TS config
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Releases via [release-please](https://github.com/googleapis/release-please) GitHub Action
