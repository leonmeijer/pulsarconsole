# Pulsar Console

A modern, real-time management UI for Apache Pulsar.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab.svg)

## What is Pulsar Console?

**Pulsar Console** is a comprehensive web-based management interface for [Apache Pulsar](https://pulsar.apache.org/), the cloud-native distributed messaging and streaming platform. It provides DevOps teams, developers, and platform engineers with an intuitive way to:

- **Monitor** cluster health, message throughput, and broker status in real-time
- **Manage** tenants, namespaces, topics, and subscriptions through a visual interface
- **Debug** message flow by browsing messages without consuming them
- **Administer** user access with role-based permissions
- **Operate** multiple Pulsar clusters (dev, staging, production) from a single dashboard

Unlike the basic Pulsar Manager, Pulsar Console offers a modern dark-themed UI, real-time updates, global search, and enterprise features like OIDC authentication and granular RBAC.

## Key Features

### Cluster Management
| Feature | Description |
|---------|-------------|
| **Multi-Environment Support** | Manage multiple Pulsar clusters with instant switching |
| **Real-time Dashboard** | Live cluster health, message rates, storage usage, and broker status |
| **Broker Monitoring** | View broker details, configuration, and health metrics |
| **Global Search** | Instantly find topics, subscriptions, consumers, namespaces, and brokers |

### Resource Management
| Feature | Description |
|---------|-------------|
| **Tenant Management** | Create, configure, and delete tenants with admin role assignment |
| **Namespace Management** | Configure retention, TTL, backlog policies, and replication |
| **Topic Management** | Create partitioned/non-partitioned topics, view statistics, configure policies |
| **Subscription Management** | Monitor backlogs, skip messages, reset cursors, peek at messages |

### Message Operations
| Feature | Description |
|---------|-------------|
| **Message Browser** | Inspect messages in subscriptions without consuming them |
| **Message Details** | View payload, properties, publish time, and message metadata |
| **Backlog Management** | Clear backlogs, skip messages, seek to timestamp |

### Security & Access Control
| Feature | Description |
|---------|-------------|
| **OIDC Authentication** | Login via Zitadel, Keycloak, Auth0, Okta, Azure AD, etc. |
| **PKCE Support** | Secure browser-based authentication without client secrets |
| **Role-Based Access Control** | Granular permissions per user, role, and environment |
| **API Tokens** | Generate tokens for programmatic/CI/CD access |
| **Audit Logging** | Track all management operations with user attribution |

### Pulsar Authentication Management
| Feature | Description |
|---------|-------------|
| **Auth Status Dashboard** | View authentication/authorization status on the broker |
| **Permission Management** | Manage namespace and topic permissions for roles |
| **Superuser Management** | Configure and validate superuser access |

### User Experience
| Feature | Description |
|---------|-------------|
| **Favorites** | Quick access to frequently used resources |
| **Notifications** | Automatic alerts for consumer disconnects, broker issues, storage warnings |
| **Multiple Themes** | 8+ modern themes (Pulsar, Slate, Midnight, Obsidian, etc.) |
| **Responsive Design** | Works on desktop and tablet |
| **Authentication Guide** | Interactive guide for configuring Pulsar authentication |

## Screenshots

### Dashboard
Real-time cluster overview with health status, message throughput, and resource usage.

![Dashboard](docs/screenshots/dashboard.png)

### Pulsar Authentication
Comprehensive management of Pulsar authentication and authorization.

| Status Dashboard | Configuration Guide |
|-----------------|---------------------|
| ![Auth Status](docs/screenshots/auth-status.png) | ![Auth Guide](docs/screenshots/auth-guide.png) |

### Available Themes
Pulsar Console comes with a variety of modern themes to suit your preference.

| Pulsar Dark (Default) | Pulsar Light |
|-----------------------|--------------|
| ![Pulsar Dark](docs/screenshots/theme-pulsar-dark.png) | ![Pulsar Light](docs/screenshots/theme-pulsar-light.png) |

| Slate Dark | Slate Light |
|------------|-------------|
| ![Slate Dark](docs/screenshots/theme-slate-dark.png) | ![Slate Light](docs/screenshots/theme-slate-light.png) |

| Midnight | Obsidian |
|----------|----------|
| ![Midnight](docs/screenshots/theme-midnight.png) | ![Obsidian](docs/screenshots/theme-obsidian.png) |

| Charcoal | Snowlight |
|----------|-----------|
| ![Charcoal](docs/screenshots/theme-charcoal.png) | ![Snowlight](docs/screenshots/theme-snowlight.png) |

### Topic Detail
Detailed topic view with statistics, subscriptions, and message browser.

![Topic Detail](docs/screenshots/topic-detail.png)

### Audit Logs
Track all management operations with filtering and export capabilities.

![Audit Logs](docs/screenshots/audit-logs.png)

### Global Search
Instantly find topics, subscriptions, consumers, and brokers.

![Global Search](docs/screenshots/global-search.png)

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
   cp .env.example .env      # Edit .env with your settings
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

```bash
# Start only Pulsar
docker compose --profile full up -d pulsar
```

---

## Docker Hub Deployment

Pre-built Docker images are available on Docker Hub for quick deployment.

### Pull Images

```bash
docker pull lvms/pulsarconsole-frontend:latest
docker pull lvms/pulsarconsole-backend:latest
```

### Quick Start with Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pulsar
      POSTGRES_PASSWORD: pulsar
      POSTGRES_DB: pulsarconsole
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pulsar"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Pulsar Console Backend API
  backend:
    image: lvms/pulsarconsole-backend:latest
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://pulsar:pulsar@postgres:5432/pulsarconsole
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: change-me-in-production
      OIDC_ENABLED: "false"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # Pulsar Console Frontend
  frontend:
    image: lvms/pulsarconsole-frontend:latest
    ports:
      - "80:80"
    environment:
      VITE_API_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Start the Stack

```bash
docker compose up -d
```

### Access the Console

Open http://localhost in your browser.

### Configure Your First Environment

1. Go to **Settings > Environments**
2. Click **Add Environment**
3. Enter your Pulsar Admin URL (e.g., `http://pulsar:8080` or `https://pulsar.example.com:8443`)
4. Configure authentication if required
5. Click **Test Connection** and **Save**

### Production Considerations

For production deployments:

```yaml
backend:
  environment:
    SECRET_KEY: <generate-a-secure-random-key>
    OIDC_ENABLED: "true"
    OIDC_ISSUER_URL: https://your-idp.example.com
    OIDC_CLIENT_ID: pulsar-console
    OIDC_USE_PKCE: "true"
```

Generate a secure secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Authentication Configuration

Pulsar Console has **two independent authentication layers**:

1. **Console Authentication** — How users log in to the web UI
2. **Pulsar API Authentication** — How the Console connects to Pulsar brokers

### Quick Reference

| Scenario | Console Auth | Pulsar Auth | Use Case |
|----------|--------------|-------------|----------|
| Local development | Disabled | None | Quick testing |
| Internal team | OIDC (PKCE) | Token | Secure internal use |
| Production | OIDC (PKCE) | Token/OAuth | Full security |
| Open cluster | Disabled | None | Demo/playground |

---

## Console Authentication (User Login)

Controls how users authenticate to the Pulsar Console web interface.

### Option 1: No Authentication (Development)

Users can access the Console without logging in. A default admin user is created automatically.

```bash
# backend/.env
OIDC_ENABLED=false
```

**When to use:** Local development, demos, trusted networks.

### Option 2: OIDC with PKCE (Recommended)

Users authenticate via an OIDC provider using PKCE (Proof Key for Code Exchange). This is the most secure option for browser-based applications.

```bash
# backend/.env
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://auth.example.com
OIDC_CLIENT_ID=pulsar-console
OIDC_USE_PKCE=true
# OIDC_CLIENT_SECRET is NOT required with PKCE
```

**Supported providers:** Zitadel, Keycloak, Auth0, Okta, Azure AD, Google, and any OpenID Connect compliant provider.

#### What is PKCE?

PKCE (Proof Key for Code Exchange) is a security extension to OAuth 2.0 designed for public clients (like browser-based SPAs) that cannot securely store a client secret.

```
┌─────────────────────────────────────────────────────────────┐
│  Traditional OAuth (NOT recommended for browsers)           │
│                                                             │
│  Browser ──► Backend ──► OIDC Provider                     │
│                 │                                           │
│                 └── Client Secret (exposed risk!)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PKCE Flow (Recommended)                                    │
│                                                             │
│  Browser ──► Backend ──► OIDC Provider                     │
│     │                         │                             │
│     └── code_verifier ────────┘                            │
│         (one-time, cryptographic proof)                    │
│                                                             │
│  ✓ No client secret needed                                 │
│  ✓ Secure against authorization code interception          │
└─────────────────────────────────────────────────────────────┘
```

#### OIDC Provider Setup

**Zitadel:**
1. Create a new Application (Type: Web)
2. Set Authentication Method to **PKCE**
3. Add Redirect URI: `http://localhost:8000/api/v1/auth/callback`
4. Copy the Client ID to your `.env`

**Keycloak:**
1. Create a new Client
2. Set Access Type to **public**
3. Enable **Standard Flow**
4. Set Valid Redirect URIs: `http://localhost:8000/api/v1/auth/callback`

**Auth0:**
1. Create a new Application (Type: Single Page Application)
2. PKCE is enabled by default for SPAs
3. Add Callback URL: `http://localhost:8000/api/v1/auth/callback`

### Option 3: OIDC with Client Secret

For environments where PKCE is not supported, you can use the traditional client secret flow.

```bash
# backend/.env
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://auth.example.com
OIDC_CLIENT_ID=pulsar-console
OIDC_CLIENT_SECRET=your-client-secret
OIDC_USE_PKCE=false
```

**When to use:** Legacy OIDC providers that don't support PKCE.

### All Console Auth Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OIDC_ENABLED` | Enable OIDC authentication | `false` |
| `OIDC_ISSUER_URL` | OIDC provider URL (e.g., `https://auth.example.com`) | — |
| `OIDC_CLIENT_ID` | OAuth client ID | — |
| `OIDC_CLIENT_SECRET` | OAuth client secret (optional with PKCE) | — |
| `OIDC_USE_PKCE` | Use PKCE flow (recommended) | `true` |
| `OIDC_SCOPES` | OAuth scopes to request | `openid profile email` |

---

## Pulsar API Authentication

Controls how the Console backend connects to Pulsar brokers. This is configured **per environment** in the UI.

### Option 1: No Authentication

For Pulsar clusters without authentication enabled.

```yaml
# Environment settings in UI
Auth Mode: none
```

### Option 2: Token Authentication

Use a static JWT token for authentication. This is the most common setup.

```yaml
# Environment settings in UI
Auth Mode: token
Token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Generating a Pulsar token:**
```bash
# Using pulsar-admin CLI
bin/pulsar tokens create --secret-key file:///path/to/secret.key \
    --subject admin

# Or using the Pulsar Docker container
docker exec -it pulsar bin/pulsar tokens create \
    --secret-key file:///pulsar/tokens/secret.key \
    --subject admin
```

### Option 3: OAuth/OIDC (Client Credentials)

For Pulsar clusters configured with OAuth authentication.

```yaml
# Environment settings in UI
Auth Mode: oidc
OIDC Mode: passthrough  # or console_only
```

**Note:** Pulsar uses **Client Credentials** flow (machine-to-machine), not PKCE. This is expected behavior since Pulsar clients are backend services, not interactive browser applications.

### Superuser Token

For managing Pulsar authentication settings (enabling/disabling auth, managing permissions), you can configure a separate superuser token:

```yaml
# Environment settings in UI
Superuser Token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

This token is used for privileged operations like:
- Viewing authentication status
- Managing namespace/topic permissions
- RBAC synchronization with Pulsar

---

## Environment Configuration

### Adding a New Environment

1. Navigate to **Settings > Environments**
2. Click **Add Environment**
3. Configure:

| Setting | Description | Example |
|---------|-------------|---------|
| Name | Display name | `Production` |
| Admin URL | Pulsar Admin REST API | `https://pulsar.example.com:8443` |
| Auth Mode | `none`, `token`, or `oidc` | `token` |
| Token | JWT token (if using token auth) | `eyJ...` |
| Superuser Token | Token for auth management | `eyJ...` |
| RBAC Enabled | Enable role-based permissions | `true` |

4. Click **Test Connection** to verify
5. Click **Save**

### Switching Environments

Use the environment selector in the top-right header to switch between configured clusters.

---

## Role-Based Access Control (RBAC)

Pulsar Console includes a built-in RBAC system for managing user permissions.

### Default Roles

| Role | Description |
|------|-------------|
| `superuser` | Full access to all features including user management |
| `admin` | Full access to Pulsar resources (tenants, namespaces, topics) |
| `operator` | Manage topics, subscriptions, and messages |
| `developer` | Read access plus message publishing |
| `viewer` | Read-only access to all resources |

### Permission Levels

| Resource | Actions |
|----------|---------|
| **Tenants** | `read`, `write`, `delete` |
| **Namespaces** | `read`, `write`, `delete` |
| **Topics** | `read`, `write`, `delete` |
| **Subscriptions** | `read`, `write`, `delete` |
| **Messages** | `read`, `write` |
| **Brokers** | `read` |
| **Settings** | `read`, `write` |
| **Users** | `read`, `write` |
| **Audit** | `read` |

### First User Behavior

When OIDC is enabled and no users exist:
1. The first user to log in is automatically assigned the **superuser** role
2. Subsequent users must be approved and assigned roles by an admin

### OIDC Group-to-Role Mapping

Automatically assign roles based on OIDC group membership. This enables seamless integration with your identity provider's group management.

#### Global Admin Groups

Users in specified OIDC groups are automatically granted global admin access:

```bash
# backend/.env
OIDC_ADMIN_GROUPS=admins,superusers,pulsar-admins
```

#### Configuration via Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OIDC_ROLE_CLAIM` | OIDC claim containing user groups | `groups` |
| `OIDC_ADMIN_GROUPS` | Comma-separated list of admin groups | — |
| `OIDC_SYNC_ROLES_ON_LOGIN` | Sync roles on every login | `true` |

#### Configuration via UI

Navigate to **Settings > OIDC Groups** to configure:

1. **Role Claim** — The OIDC claim name containing user groups (e.g., `groups`, `roles`, `memberOf`)
2. **Global Admin Groups** — OIDC groups that grant full admin access
3. **Group-to-Role Mappings** — Map specific OIDC groups to Console roles

Example mappings:
- `developers` → `developer`
- `operations` → `operator`
- `platform-team` → `admin`

#### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  User Login Flow with Group Mapping                         │
│                                                             │
│  1. User authenticates via OIDC provider                   │
│  2. OIDC token contains groups claim:                      │
│     { "groups": ["developers", "platform-team"] }          │
│                                                             │
│  3. Console checks group mappings:                         │
│     - "developers" → assigns "developer" role              │
│     - "platform-team" → assigns "admin" role               │
│                                                             │
│  4. If sync_roles_on_login is enabled:                     │
│     - Roles not in current groups are removed              │
│     - Ensures role assignments stay in sync with IdP       │
└─────────────────────────────────────────────────────────────┘
```

#### OIDC Provider Configuration

**Keycloak:**
- Enable "Full group path" in client mappers
- Or configure a custom mapper for the `groups` claim

**Zitadel:**
- Groups are included automatically when configured in actions
- Or use roles with custom claims

**Auth0:**
- Configure a post-login Action to add groups to tokens
- Or use Auth0 Organizations for group management

---

## API Tokens

Generate API tokens for programmatic access (CI/CD, scripts, automation).

### Creating a Token

1. Navigate to **Settings > API Tokens**
2. Click **Create Token**
3. Configure name, expiration, and permissions
4. Copy the token (shown only once!)

### Using API Tokens

```bash
# Example: List tenants
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/tenants

# Example: Get topic stats
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/topics/public/default/my-topic/stats
```

---

## Configuration Reference

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `SECRET_KEY` | JWT signing key | — |
| `OIDC_ENABLED` | Enable OIDC authentication | `false` |
| `OIDC_ISSUER_URL` | OIDC provider URL | — |
| `OIDC_CLIENT_ID` | OAuth client ID | — |
| `OIDC_CLIENT_SECRET` | OAuth client secret | — |
| `OIDC_USE_PKCE` | Use PKCE flow | `true` |
| `OIDC_ROLE_CLAIM` | OIDC claim containing user groups | `groups` |
| `OIDC_ADMIN_GROUPS` | Groups that grant global admin (comma-separated) | — |
| `OIDC_SYNC_ROLES_ON_LOGIN` | Sync roles from groups on login | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |
| `LOG_LEVEL` | Logging level | `INFO` |

See `backend/.env.example` for the complete list.

---

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
