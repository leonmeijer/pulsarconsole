# Design Document

## Overview

This document describes the architecture and design for a modern reimplementation of Apache Pulsar Manager. The system provides a web-based management and monitoring interface for Apache Pulsar clusters, replacing the original Java/Spring Boot backend with Python/FastAPI and the Vue.js 2.7 frontend with React 19.

The architecture follows a three-tier pattern:
1. **Web UI** - React 19 single-page application served via static hosting
2. **Control Plane API** - FastAPI backend that wraps Pulsar Admin REST API and provides caching, aggregation, and business logic
3. **Worker** - Background process for periodic metrics collection and precomputation

The system manages a single Pulsar environment without authentication requirements, focusing on operational simplicity while maintaining enterprise-grade observability and reliability.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Web UI (React 19 + Vite)            │
│         Served via Nginx/Caddy              │
│         Port: 5173 (dev) / 80 (prod)        │
└─────────────────┬───────────────────────────┘
                  │ HTTP/REST + OpenAPI Client
┌─────────────────▼───────────────────────────┐
│    Control Plane API (FastAPI + Uvicorn)    │
│              Port: 8000                     │
│    ┌──────────────────────────────────┐    │
│    │  Routes & Request Handlers       │    │
│    ├──────────────────────────────────┤    │
│    │  Business Logic Services         │    │
│    ├──────────────────────────────────┤    │
│    │  Repository Layer (SQLAlchemy)   │    │
│    └──────────────────────────────────┘    │
└─────────┬───────────────────┬───────────────┘
          │                   │
          │ Pulsar Admin API  │ Cache/DB Access
          │                   │
┌─────────▼─────────┐   ┌─────▼──────────────┐
│  Apache Pulsar    │   │  PostgreSQL        │
│  Cluster          │   │  (Datastore)       │
│  - Brokers        │   │  - Config          │
│  - Topics         │   │  - Audit Logs      │
│  - Subscriptions  │   │  - Cached Stats    │
└───────────────────┘   └────────────────────┘
                        ┌────────────────────┐
                        │  Redis             │
                        │  (Cache Layer)     │
                        │  - Session Cache   │
                        │  - Rate Limiting   │
                        │  - Distributed Lock│
                        └────────────────────┘
┌─────────────────────────────────────────────┐
│         Worker (Celery/APScheduler)         │
│    - Periodic Stats Collection              │
│    - Aggregation Precomputation             │
│    - Cleanup Tasks                          │
└─────────────────────────────────────────────┘
```

### Component Responsibilities

**Web UI**
- Renders all user interfaces using React components
- Manages client-side routing with React Router 7
- Handles data fetching and caching with TanStack Query v5
- Provides real-time updates with automatic background refresh
- Uses generated TypeScript client from OpenAPI specification

**Control Plane API**
- Exposes REST endpoints for all management operations
- Wraps Pulsar Admin REST API with error handling and retries
- Implements caching strategy to reduce load on Pulsar cluster
- Validates requests using Pydantic models
- Writes audit logs for all mutations
- Generates OpenAPI specification automatically

**Worker**
- Executes scheduled tasks for metrics collection
- Precomputes aggregations for fast query response
- Cleans up stale cache entries
- Handles long-running operations asynchronously

**Datastore (PostgreSQL)**
- Stores environment configuration
- Persists audit logs
- Caches topic, subscription, and broker statistics
- Stores precomputed aggregations

**Cache Layer (Redis)**
- Provides fast access to frequently requested data
- Implements rate limiting for message browsing
- Manages distributed locks for worker coordination
- Stores short-lived session data

## Components and Interfaces

### Web UI Components

**Technology Stack**
- React 19 with TypeScript
- Vite for build and development
- React Router 7 for routing
- TanStack Query v5 for data fetching
- Tailwind CSS v4 for styling
- Radix UI for accessible primitives
- Lucide React for icons
- Framer Motion for animations
- Recharts for data visualization

**Page Components**

1. **DashboardPage**
   - Displays overview metrics: total tenants, namespaces, topics, subscriptions
   - Shows cluster health status
   - Renders charts for message rates and storage usage
   - Auto-refreshes every 30 seconds

2. **TenantsPage** (Partially implemented)
   - Lists all tenants with search and filter
   - Provides create/edit/delete actions
   - Shows aggregated statistics per tenant
   - Links to namespace view

3. **NamespacesPage**
   - Lists namespaces for selected tenant
   - Displays policy configurations (retention, TTL, backlog quota)
   - Provides policy editing interface
   - Shows namespace-level statistics

4. **TopicsPage**
   - Lists topics for selected namespace
   - Supports filtering by persistent/non-persistent
   - Shows partition count, backlog, message rate
   - Provides topic creation and deletion
   - Links to topic detail view

5. **TopicDetailPage**
   - Displays detailed topic information
   - Shows subscription list with backlog and consumer count
   - Provides message browser interface
   - Renders time-series charts for throughput

6. **SubscriptionsPage**
   - Lists subscriptions for selected topic
   - Shows backlog, message rate, consumer count
   - Provides cursor reset and skip operations
   - Displays consumer details

7. **BrokersPage**
   - Lists active brokers with service URLs
   - Shows CPU, memory, and connection metrics
   - Displays namespace bundle assignments
   - Provides broker health indicators

8. **AuditLogsPage**
   - Lists audit events with filtering
   - Supports time range selection
   - Provides search by resource and action type
   - Exports logs to CSV/JSON

**Shared Components**

- **DataTable** - Reusable table with sorting, filtering, pagination
- **MetricCard** - Displays single metric with trend indicator
- **ChartContainer** - Wrapper for Recharts with responsive sizing
- **ConfirmDialog** - Modal for destructive action confirmation
- **FormField** - Accessible form input with validation display
- **LoadingSpinner** - Consistent loading indicator
- **ErrorBoundary** - Catches and displays component errors

**API Client**

Generated from OpenAPI specification using openapi-typescript-codegen or similar:
- Type-safe request functions for all endpoints
- Automatic request/response validation
- Built-in error handling
- Request cancellation support

### Control Plane API Components

**Technology Stack**
- Python 3.12+
- FastAPI for web framework
- Pydantic v2 for data validation
- SQLAlchemy 2.0 for ORM
- Alembic for migrations
- httpx for HTTP client (Pulsar Admin API)
- Redis client (redis-py)
- Celery or APScheduler for background tasks
- Prometheus client for metrics
- Structlog for structured logging

**API Routes**

All routes follow RESTful conventions and return JSON responses.

1. **Environment Routes** (`/api/v1/environment`)
   - `GET /` - Get environment configuration
   - `PUT /` - Update environment configuration
   - `POST /test-connection` - Test Pulsar connectivity

2. **Tenant Routes** (`/api/v1/tenants`)
   - `GET /` - List all tenants with statistics
   - `POST /` - Create new tenant
   - `GET /{tenant}` - Get tenant details
   - `PUT /{tenant}` - Update tenant configuration
   - `DELETE /{tenant}` - Delete tenant

3. **Namespace Routes** (`/api/v1/tenants/{tenant}/namespaces`)
   - `GET /` - List namespaces for tenant
   - `POST /` - Create namespace
   - `GET /{namespace}` - Get namespace details
   - `PUT /{namespace}/policies` - Update namespace policies
   - `DELETE /{namespace}` - Delete namespace

4. **Topic Routes** (`/api/v1/tenants/{tenant}/namespaces/{namespace}/topics`)
   - `GET /` - List topics in namespace
   - `POST /` - Create topic
   - `GET /{topic}` - Get topic details
   - `GET /{topic}/stats` - Get topic statistics
   - `PUT /{topic}/partitions` - Update partition count
   - `DELETE /{topic}` - Delete topic

5. **Subscription Routes** (`/api/v1/topics/{topic}/subscriptions`)
   - `GET /` - List subscriptions for topic
   - `POST /` - Create subscription
   - `GET /{subscription}` - Get subscription details
   - `POST /{subscription}/reset` - Reset cursor
   - `POST /{subscription}/skip` - Skip messages
   - `DELETE /{subscription}` - Delete subscription

6. **Message Browser Routes** (`/api/v1/topics/{topic}/messages`)
   - `GET /` - Sample messages from topic (with limits)

7. **Broker Routes** (`/api/v1/brokers`)
   - `GET /` - List active brokers
   - `GET /{broker}/stats` - Get broker statistics
   - `GET /bundles` - Get namespace bundle assignments

8. **Audit Routes** (`/api/v1/audit`)
   - `GET /` - List audit events with filtering

9. **Metrics Routes**
   - `GET /metrics` - Prometheus metrics endpoint
   - `GET /health` - Health check endpoint

**Service Layer**

1. **PulsarAdminService**
   - Wraps httpx client for Pulsar Admin REST API
   - Manages connection pooling and timeouts
   - Implements retry logic with exponential backoff
   - Handles authentication token injection
   - Normalizes error responses

2. **EnvironmentService**
   - Loads and validates environment configuration
   - Tests connectivity to Pulsar cluster
   - Manages credential encryption/decryption

3. **TenantService**
   - Retrieves tenant list from Pulsar
   - Creates, updates, deletes tenants
   - Aggregates statistics across namespaces
   - Validates tenant names

4. **NamespaceService**
   - Manages namespace lifecycle
   - Applies and retrieves policies
   - Validates namespace names and policy values

5. **TopicService**
   - Lists and filters topics
   - Creates partitioned and non-partitioned topics
   - Retrieves topic statistics
   - Manages topic deletion with dependency checks

6. **SubscriptionService**
   - Lists subscriptions with statistics
   - Creates subscriptions with initial position
   - Resets cursors to message ID or timestamp
   - Skips messages in subscription

7. **MessageBrowserService**
   - Creates Pulsar Python client reader
   - Enforces sampling limits (max messages, max payload size)
   - Implements rate limiting per session
   - Returns messages with metadata

8. **BrokerService**
   - Retrieves broker list and metadata
   - Collects broker statistics
   - Retrieves namespace bundle assignments

9. **AuditService**
   - Writes audit events to database
   - Queries audit logs with filtering
   - Exports audit data

10. **CacheService**
    - Manages Redis cache operations
    - Implements cache invalidation strategies
    - Provides cache-aside pattern helpers

**Repository Layer**

1. **EnvironmentRepository**
   - CRUD operations for environment configuration
   - Encrypts/decrypts sensitive fields

2. **AuditRepository**
   - Inserts audit events
   - Queries with time range and filter support
   - Uses indexed queries for performance

3. **StatsRepository**
   - Stores topic, subscription, broker statistics
   - Retrieves cached statistics with age metadata
   - Implements batch insert for worker

4. **AggregationRepository**
   - Stores precomputed aggregations
   - Retrieves aggregations by tenant/namespace

**Middleware**

1. **RequestLoggingMiddleware**
   - Logs all requests with correlation ID
   - Records request duration and status

2. **ErrorHandlingMiddleware**
   - Catches exceptions and returns consistent error format
   - Logs errors with stack traces

3. **CORSMiddleware**
   - Configures CORS for Web UI origin

### Worker Components

**Task Definitions**

1. **collect_topic_stats**
   - Scheduled every 30 seconds
   - Retrieves statistics for all topics
   - Batch inserts to database

2. **collect_subscription_stats**
   - Scheduled every 30 seconds
   - Retrieves statistics for all subscriptions
   - Batch inserts to database

3. **collect_broker_stats**
   - Scheduled every 60 seconds
   - Retrieves broker metrics
   - Stores in database

4. **compute_aggregations**
   - Scheduled every 60 seconds
   - Computes tenant and namespace aggregations
   - Stores precomputed results

5. **cleanup_old_stats**
   - Scheduled daily
   - Deletes statistics older than retention period
   - Vacuums database tables

**Worker Configuration**

- Uses Celery with Redis as broker and result backend
- Configures task routing and priorities
- Implements task retry with exponential backoff
- Monitors task execution with Prometheus metrics

## Data Models

### Database Schema (PostgreSQL)

**environments**
```sql
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    admin_url VARCHAR(512) NOT NULL,
    auth_mode VARCHAR(50) NOT NULL DEFAULT 'none',
    token_encrypted TEXT,
    ca_bundle_ref TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**audit_events**
```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(512) NOT NULL,
    request_params JSONB,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_audit_timestamp (timestamp DESC),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_action (action)
);
```

**topic_stats**
```sql
CREATE TABLE topic_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id),
    tenant VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    topic VARCHAR(512) NOT NULL,
    partition_count INTEGER NOT NULL DEFAULT 1,
    msg_rate_in DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_rate_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_throughput_in DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_throughput_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    storage_size BIGINT NOT NULL DEFAULT 0,
    backlog_size BIGINT NOT NULL DEFAULT 0,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_topic_stats_collected (collected_at DESC),
    INDEX idx_topic_stats_topic (tenant, namespace, topic)
);
```

**subscription_stats**
```sql
CREATE TABLE subscription_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id),
    tenant VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    topic VARCHAR(512) NOT NULL,
    subscription VARCHAR(255) NOT NULL,
    msg_rate_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_throughput_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_backlog BIGINT NOT NULL DEFAULT 0,
    consumer_count INTEGER NOT NULL DEFAULT 0,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_sub_stats_collected (collected_at DESC),
    INDEX idx_sub_stats_subscription (tenant, namespace, topic, subscription)
);
```

**broker_stats**
```sql
CREATE TABLE broker_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id),
    broker_url VARCHAR(512) NOT NULL,
    cpu_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    direct_memory_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_rate_in DOUBLE PRECISION NOT NULL DEFAULT 0,
    msg_rate_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    connection_count INTEGER NOT NULL DEFAULT 0,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_broker_stats_collected (collected_at DESC),
    INDEX idx_broker_stats_broker (broker_url)
);
```

**aggregations**
```sql
CREATE TABLE aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id),
    aggregation_type VARCHAR(50) NOT NULL,
    aggregation_key VARCHAR(512) NOT NULL,
    topic_count INTEGER NOT NULL DEFAULT 0,
    total_backlog BIGINT NOT NULL DEFAULT 0,
    total_msg_rate_in DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_msg_rate_out DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_storage_size BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_agg_type_key (aggregation_type, aggregation_key),
    INDEX idx_agg_computed (computed_at DESC)
);
```

### Redis Cache Keys

```
environment:config -> EnvironmentConfig JSON
tenants:list -> List[TenantInfo] JSON
tenant:{tenant}:namespaces -> List[NamespaceInfo] JSON
namespace:{tenant}/{namespace}:topics -> List[TopicInfo] JSON
topic:{topic}:stats -> TopicStats JSON
topic:{topic}:subscriptions -> List[SubscriptionInfo] JSON
broker:list -> List[BrokerInfo] JSON
broker:{broker}:stats -> BrokerStats JSON
ratelimit:browse:{session_id} -> Counter with TTL
```

Cache TTLs:
- Environment config: 300 seconds
- Tenant/namespace/topic lists: 60 seconds
- Statistics: 30 seconds
- Broker info: 60 seconds
- Rate limit counters: 60 seconds

## Correctness Properties

After analyzing all acceptance criteria, the following properties have been identified as testable through property-based testing. Properties that are redundant or subsumed by other properties have been eliminated.

### Core Management Properties (13)

1. Environment configuration validation before persistence
2. Credential encryption at rest
3. Tenant name validation
4. Tenant deletion dependency check
5. Cache invalidation on mutations
6. Namespace name validation
7. Namespace deletion dependency check
8. Topic name and partition validation
9. Topic details completeness
10. Partition expansion only
11. Topic deletion dependency check
12. Subscription details completeness
13. Subscription name validation

### Message Browsing Properties (5)

14. Message sampling count limit enforcement
15. Message payload size limit enforcement
16. Message browsing rate limiting
17. Message browsing immutability
18. Message metadata completeness

### Monitoring and Statistics Properties (10)

19. Broker information completeness
20. Broker statistics completeness
21. Statistics collection completeness for topics
22. Statistics collection completeness for subscriptions
23. Statistics persistence with metadata
24. Cached statistics include age metadata
25. Tenant-level aggregation correctness
26. Namespace-level aggregation correctness
27. Aggregated query performance
28. Aggregation retry with exponential backoff

### Audit and Observability Properties (14)

29. Audit event creation for mutations
30. Audit event completeness
31. Audit log filtering
32. Audit log query performance
33. Audit event atomicity
34. API error handling with cached data
35. UI optimistic updates reconciliation
36. UI recovery after connectivity restoration
37. Form validation feedback
38. OpenAPI specification automatic updates
39. Structured log completeness for requests
40. Structured log completeness for tasks
41. Error log correlation
42. Distributed trace connectivity

### Resilience Properties (8)

43. Pulsar API retry with exponential backoff
44. Worker resilience to collection failures
45. Connection pool exhaustion handling
46. Database failure fallback
47. Parameterized query usage
48. Transaction rollback on error
49. Batch insert usage for statistics
50. Horizontal scaling state sharing

### Export Properties (4)

51. Export filter application
52. Subscription export completeness
53. Large export streaming
54. Export filename descriptiveness

## Error Handling

### Error Response Format

All API errors return consistent JSON structure:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Topic 'persistent://public/default/my-topic' not found",
    "details": {
      "resource_type": "topic",
      "resource_id": "persistent://public/default/my-topic"
    },
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-26T10:30:00Z"
  }
}
```

### Retry Strategy

**Pulsar Admin REST API Calls**
- Retry on: 502, 503, 504, connection errors, timeouts
- Max retries: 3
- Backoff: Exponential (1s, 2s, 4s)
- Circuit breaker: Open after 5 consecutive failures, half-open after 30s

**Database Operations**
- Retry on: Connection errors, deadlocks
- Max retries: 3
- Backoff: Exponential (100ms, 200ms, 400ms)

**Worker Tasks**
- Retry on: All failures except validation errors
- Max retries: 3
- Backoff: Exponential (5s, 10s, 20s)
- Dead letter queue: Failed tasks after max retries

## Testing Strategy

### Unit Testing

**Framework**: pytest for Python, Vitest for TypeScript

**Coverage Goals**
- Service layer: 80%+ coverage
- Repository layer: 90%+ coverage
- API routes: 70%+ coverage
- React components: 60%+ coverage

### Property-Based Testing

**Framework**: Hypothesis for Python

**Configuration**
- Minimum iterations per property: 100
- Maximum examples to generate: 1000
- Shrinking enabled for minimal failing examples
- Seed for reproducibility in CI

### Integration Testing

**Scope**
- API endpoint to database round trips
- Worker task execution with real database
- Cache invalidation across services
- OpenAPI client generation and usage

### End-to-End Testing

**Framework**: Playwright for Web UI

**Scope**
- Complete user workflows through Web UI
- Multi-page navigation and state management
- Real-time updates and error handling
- Accessibility compliance

## Deployment Architecture

### Docker Compose (Development)

```yaml
services:
  ui:
    build: ./frontend
    ports:
      - "5173:5173"
  api:
    build: ./backend
    ports:
      - "8000:8000"
  worker:
    build: ./backend
    command: celery -A app.worker worker
  postgres:
    image: postgres:16
  redis:
    image: redis:7
  pulsar:
    image: apachepulsar/pulsar:3.3.2
    command: bin/pulsar standalone
```

### Kubernetes Resources

**Deployments**
- `pulsar-manager-ui`: Nginx serving static React build
- `pulsar-manager-api`: FastAPI with Uvicorn, 3 replicas
- `pulsar-manager-worker`: Celery worker, 2 replicas

**StatefulSets**
- `postgresql`: Single instance with persistent volume
- `redis`: Single instance with persistent volume

**Services**
- `pulsar-manager-ui-svc`: ClusterIP, port 80
- `pulsar-manager-api-svc`: ClusterIP, port 8000
- `postgresql-svc`: ClusterIP, port 5432
- `redis-svc`: ClusterIP, port 6379

**Ingress**
- Routes `/` to UI service
- Routes `/api/*` to API service
- TLS termination with cert-manager
