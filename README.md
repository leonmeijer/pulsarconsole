# Pulsar Console

A modern, real-time management UI for Apache Pulsar.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab.svg)

## Overview

Pulsar Console is a sleek, real-time web interface for managing and monitoring Apache Pulsar clusters. Built with React and Python FastAPI, it provides intuitive dashboards, topic management, subscription monitoring, and message browsing — all with a modern dark-themed UI.

## Features

- **Real-time Monitoring** — Live cluster health, message throughput, and broker status
- **Multi-Environment Support** — Manage multiple Pulsar clusters with quick switching
- **Topic Management** — Create, delete, and configure topics with partition support
- **Subscription Management** — Monitor backlogs, skip messages, and reset cursors
- **Message Browser** — Inspect messages in subscriptions without consuming them
- **Multi-tenant Support** — Navigate tenants, namespaces, and topics hierarchically
- **Global Search** — Instantly find topics, subscriptions, consumers, namespaces, and brokers
- **Notifications** — Automatic alerts for consumer disconnects, broker health issues, and storage warnings
- **OIDC Authentication** — Secure login with PKCE support (Zitadel, Keycloak, Auth0, etc.)
- **RBAC** — Role-based access control with customizable permissions
- **API Tokens** — Generate tokens for programmatic access
- **Favorites** — Quick access to frequently used tenants, namespaces, topics, and subscriptions
- **Audit Logging** — Track all management operations

## Screenshots

*Coming soon*

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose (optional)
- Access to an Apache Pulsar cluster

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/leonmeijer/pulsarconsole.git
   cd pulsarconsole
   ```

2. **Start infrastructure** (PostgreSQL, Redis)
   ```bash
   docker compose up -d postgres redis
   ```

3. **Setup backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env      # Edit .env with your Pulsar cluster URL
   alembic upgrade head      # Run database migrations
   uvicorn app.main:app --reload
   ```

4. **Setup frontend**
   ```bash
   cd ..  # Back to root
   npm install
   npm run dev
   ```

5. **Open** http://localhost:5173

### Docker Compose (Full Stack)

```bash
# Start everything including a local Pulsar instance
docker compose --profile full up -d
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PULSAR_ADMIN_URL` | Pulsar Admin REST API URL | `http://localhost:8080` |
| `PULSAR_AUTH_TOKEN` | Authentication token (optional) | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |

See `backend/.env.example` for all available options.

## Multi-Environment Management

Pulsar Console supports managing multiple Pulsar clusters from a single interface.

### Features

- **Add environments** — Configure connections to different Pulsar clusters (dev, staging, production)
- **Quick switching** — Use the environment selector in the header to switch between clusters
- **Per-environment auth** — Each environment can have its own authentication settings
- **Test connectivity** — Verify cluster connections before saving

### Environment Settings

| Setting | Description |
|---------|-------------|
| Name | Display name (e.g., "Production", "Staging") |
| Admin URL | Pulsar Admin REST API URL |
| Auth Mode | `none`, `token`, or `oauth2` |
| Token | JWT token (when using token auth) |

### Managing Environments

1. Navigate to **Environment** in the sidebar
2. Click **Add Environment** to configure a new cluster
3. Use the **environment selector** in the header for quick switching
4. Edit or delete environments from the Environment page

## Authentication

Pulsar Console supports two independent authentication flows:

### 1. Console Login (User Authentication)

Users authenticate to the Pulsar Console web UI via OIDC with **PKCE** (Proof Key for Code Exchange).

```
User (Browser) ──► Pulsar Console ──► OIDC Provider (Zitadel, Keycloak, etc.)
                        │
                        └── PKCE: No client secret required
```

**Configuration:**

```bash
# backend/.env
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://auth.example.com
OIDC_CLIENT_ID=pulsar-console
OIDC_USE_PKCE=true                    # Recommended (default)
# OIDC_CLIENT_SECRET=...              # Optional with PKCE
```

**OIDC Provider Setup (e.g., Zitadel):**

| Setting | Value |
|---------|-------|
| Application Type | Web |
| Authentication | PKCE |
| Redirect URI | `http://localhost:8000/api/v1/auth/callback` |

### 2. Pulsar API Authentication

The Console backend connects to Pulsar Admin API using token or client credentials (configured per environment).

```
Pulsar Console (Backend) ──► Pulsar Broker (Admin API)
                                    │
                                    └── Token or Client Credentials
```

**Note:** Pulsar does not support PKCE — it uses Client Credentials flow for OAuth. This is expected since Pulsar clients are machine-to-machine services, not interactive user flows.

**Configuration (per Environment in UI):**

| Auth Mode | Description |
|-----------|-------------|
| `none` | No authentication |
| `token` | Static JWT token |
| `oidc` | OAuth Client Credentials |

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    User Authentication                         │
│                                                                │
│   Browser ───PKCE───► Console Backend ───► OIDC Provider      │
│                              │                                 │
│                              ▼                                 │
│                       JWT Session                              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    Pulsar API Access                           │
│                                                                │
│   Console Backend ───Token/OAuth───► Pulsar Admin API         │
│                                                                │
│   (Client Credentials - no PKCE)                              │
└────────────────────────────────────────────────────────────────┘
```

## Role-Based Access Control (RBAC)

Pulsar Console includes a built-in RBAC system for managing user permissions.

### Default Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all features |
| `operator` | Manage topics, subscriptions, and messages |
| `viewer` | Read-only access to all resources |

### Permissions

Permissions are organized by resource type:

- **Tenants** — `tenants:read`, `tenants:write`, `tenants:delete`
- **Namespaces** — `namespaces:read`, `namespaces:write`, `namespaces:delete`
- **Topics** — `topics:read`, `topics:write`, `topics:delete`
- **Subscriptions** — `subscriptions:read`, `subscriptions:write`, `subscriptions:delete`
- **Messages** — `messages:read`, `messages:write`
- **Brokers** — `brokers:read`
- **Settings** — `settings:read`, `settings:write`

### API Tokens

Generate API tokens for programmatic access:

1. Navigate to **Settings > API Tokens**
2. Click **Create Token**
3. Set name, expiration, and permissions
4. Copy the token (shown only once)

```bash
# Example: Use token with curl
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/tenants
```

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- TanStack Query for data fetching
- Tailwind CSS for styling
- Framer Motion for animations
- Recharts for visualizations

### Backend
- Python 3.11+ with FastAPI
- SQLAlchemy with async PostgreSQL
- Redis for caching
- Celery for background tasks

## Project Structure

```
pulsarconsole/
├── src/                    # React frontend
│   ├── api/               # API client and hooks
│   ├── components/        # Reusable UI components
│   ├── pages/             # Page components
│   ├── context/           # React context providers
│   └── hooks/             # Custom React hooks
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── api/          # REST API endpoints
│   │   ├── services/     # Business logic
│   │   ├── repositories/ # Data access layer
│   │   ├── models/       # Database models
│   │   ├── middleware/   # Auth & RBAC middleware
│   │   └── worker/       # Celery tasks
│   └── alembic/          # Database migrations
├── docker-compose.yml     # Development setup
└── docker-compose.prod.yml # Production setup
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Apache Pulsar](https://pulsar.apache.org/) — The distributed messaging platform
- [Lucide Icons](https://lucide.dev/) — Beautiful open source icons
