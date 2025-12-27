# Implementation Plan

## Current Project Status

The pulsar-manager-react project already has:
- [x] React 19 + Vite + TypeScript setup
- [x] Tailwind CSS v4 configured
- [x] TanStack Query v5 integrated
- [x] Basic FastAPI backend with CORS
- [x] Tenants page (basic, with mock data)
- [x] Clusters page (static data only)
- [x] Layout component with sidebar navigation
- [x] Glassmorphic dark theme UI

---

## Phase 1: Backend Infrastructure & Database Layer

- [ ] 1. Set up backend project structure properly
  - Reorganize backend into proper Python package structure
  - Add pyproject.toml with all dependencies (SQLAlchemy, Alembic, httpx, redis, celery, structlog, prometheus-client)
  - Configure Ruff for linting
  - Set up Docker Compose for PostgreSQL, Redis, and Pulsar
  - Create .env.example with all configuration options
  - _Requirements: All_

- [ ] 2. Implement database layer and migrations
  - Set up SQLAlchemy 2.0 with async support (asyncpg)
  - Create Alembic migration configuration
  - Define database models for: environments, audit_events, topic_stats, subscription_stats, broker_stats, aggregations
  - Create initial migration scripts
  - Implement repository pattern base classes with abstract interfaces
  - _Requirements: 1.1, 10.1, 8.4_

- [ ] 2.1 Implement EnvironmentRepository with encryption
  - Create CRUD operations for environment configuration
  - Implement credential encryption/decryption using cryptography library
  - _Requirements: 1.1, 1.4_

- [ ] 2.2 Write property test for credential encryption
  - **Property 2: Credential encryption at rest**
  - **Validates: Requirements 1.4**

- [ ] 2.3 Implement AuditRepository with indexed queries
  - Create insert operations for audit events
  - Implement query methods with time range and filter support
  - Ensure indexes are created for timestamp, resource_type, and action columns
  - _Requirements: 10.1, 10.3, 10.4_

- [ ] 2.4 Write property test for audit event completeness
  - **Property 30: Audit event completeness**
  - **Validates: Requirements 10.2**

- [ ] 2.5 Write property test for audit log filtering
  - **Property 31: Audit log filtering**
  - **Validates: Requirements 10.3**

- [ ] 2.6 Implement StatsRepository with batch operations
  - Create batch insert methods for topic, subscription, and broker statistics
  - Implement query methods with cache age metadata
  - _Requirements: 8.4, 8.5, 16.4_

- [ ] 2.7 Write property test for batch insert usage
  - **Property 49: Batch insert usage for statistics**
  - **Validates: Requirements 16.4**

- [ ] 2.8 Implement AggregationRepository
  - Create insert and query methods for precomputed aggregations
  - Implement queries by tenant and namespace
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 2.9 Write property test for parameterized queries
  - **Property 47: Parameterized query usage**
  - **Validates: Requirements 16.2**

- [ ] 2.10 Write property test for transaction rollback
  - **Property 48: Transaction rollback on error**
  - **Validates: Requirements 16.3**

---

## Phase 2: Cache Layer & Pulsar Client

- [ ] 3. Implement Redis cache layer
  - Set up Redis client with connection pooling (redis-py async)
  - Create CacheService with get/set/delete/invalidate methods
  - Implement cache key patterns for tenants, namespaces, topics, subscriptions, brokers
  - Configure TTLs for different cache types (see design.md)
  - Implement rate limiting using Redis counters with sliding window
  - _Requirements: 2.5, 6.4, 15.5_

- [ ] 3.1 Write property test for cache invalidation
  - **Property 5: Cache invalidation on mutations**
  - **Validates: Requirements 2.5, 5.5**

- [ ] 3.2 Write property test for rate limiting
  - **Property 16: Message browsing rate limiting**
  - **Validates: Requirements 6.4**

- [ ] 4. Implement Pulsar Admin API client wrapper
  - Create PulsarAdminService with httpx async client
  - Implement connection pooling and timeout configuration
  - Add retry logic with exponential backoff for transient failures
  - Implement circuit breaker pattern
  - Create methods for tenant, namespace, topic, subscription, broker operations
  - Normalize error responses from Pulsar API
  - _Requirements: 1.2, 1.3, 1.5, 15.2_

- [ ] 4.1 Write property test for retry with exponential backoff
  - **Property 43: Pulsar API retry with exponential backoff**
  - **Validates: Requirements 15.2**

- [ ] 4.2 Write property test for connection pool exhaustion handling
  - **Property 45: Connection pool exhaustion handling**
  - **Validates: Requirements 15.4**

---

## Phase 3: Core Services

- [ ] 5. Implement core service layer - Environment management
  - Create EnvironmentService for loading and validating configuration
  - Implement connectivity testing to Pulsar cluster
  - _Requirements: 1.1, 1.2_

- [ ] 5.1 Write property test for environment validation
  - **Property 1: Environment configuration validation before persistence**
  - **Validates: Requirements 1.2**

- [ ] 6. Implement core service layer - Tenant management
  - Create TenantService with CRUD operations
  - Implement tenant name validation according to Pulsar naming rules
  - Add dependency checking for namespace existence before deletion
  - Implement statistics aggregation across namespaces
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1_

- [ ] 6.1 Write property test for tenant name validation
  - **Property 3: Tenant name validation**
  - **Validates: Requirements 2.2**

- [ ] 6.2 Write property test for tenant deletion dependency check
  - **Property 4: Tenant deletion dependency check**
  - **Validates: Requirements 2.4**

- [ ] 6.3 Write property test for tenant-level aggregation correctness
  - **Property 25: Tenant-level aggregation correctness**
  - **Validates: Requirements 9.1**

- [ ] 7. Implement core service layer - Namespace management
  - Create NamespaceService with CRUD operations
  - Implement namespace name validation according to Pulsar naming rules
  - Add policy management (retention, TTL, backlog quota, dispatch rates)
  - Add dependency checking for topic existence before deletion
  - Implement statistics aggregation across topics
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.2_

- [ ] 7.1 Write property test for namespace name validation
  - **Property 6: Namespace name validation**
  - **Validates: Requirements 3.2**

- [ ] 7.2 Write property test for namespace deletion dependency check
  - **Property 7: Namespace deletion dependency check**
  - **Validates: Requirements 3.4**

- [ ] 7.3 Write property test for namespace-level aggregation correctness
  - **Property 26: Namespace-level aggregation correctness**
  - **Validates: Requirements 9.2**

- [ ] 8. Implement core service layer - Topic management
  - Create TopicService with CRUD operations
  - Implement topic name and partition count validation
  - Add partition expansion logic with prevention of partition reduction
  - Add dependency checking for subscription existence before deletion
  - Implement topic statistics retrieval
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8.1 Write property test for topic name and partition validation
  - **Property 8: Topic name and partition validation**
  - **Validates: Requirements 4.2**

- [ ] 8.2 Write property test for topic details completeness
  - **Property 9: Topic details completeness**
  - **Validates: Requirements 4.3**

- [ ] 8.3 Write property test for partition expansion only
  - **Property 10: Partition expansion only**
  - **Validates: Requirements 4.4**

- [ ] 8.4 Write property test for topic deletion dependency check
  - **Property 11: Topic deletion dependency check**
  - **Validates: Requirements 4.5**

- [ ] 9. Implement core service layer - Subscription management
  - Create SubscriptionService with CRUD operations
  - Implement subscription name validation
  - Add cursor reset functionality (by message ID or timestamp)
  - Add message skip functionality
  - Implement subscription statistics retrieval
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9.1 Write property test for subscription name validation
  - **Property 13: Subscription name validation**
  - **Validates: Requirements 5.2**

- [ ] 9.2 Write property test for subscription details completeness
  - **Property 12: Subscription details completeness**
  - **Validates: Requirements 5.1**

- [ ] 10. Implement message browsing service with safety guardrails
  - Create MessageBrowserService using Pulsar Python client
  - Implement reader creation for topics
  - Enforce maximum message count limit per request (100 max)
  - Enforce maximum payload size limit per message (1MB max)
  - Integrate with rate limiting from CacheService
  - Ensure read-only access without topic state modification
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10.1 Write property test for message sampling count limit
  - **Property 14: Message sampling count limit enforcement**
  - **Validates: Requirements 6.2**

- [ ] 10.2 Write property test for message payload size limit
  - **Property 15: Message payload size limit enforcement**
  - **Validates: Requirements 6.3**

- [ ] 10.3 Write property test for message browsing immutability
  - **Property 17: Message browsing immutability**
  - **Validates: Requirements 6.5**

- [ ] 10.4 Write property test for message metadata completeness
  - **Property 18: Message metadata completeness**
  - **Validates: Requirements 6.5**

- [ ] 11. Implement broker monitoring service
  - Create BrokerService for broker list retrieval
  - Implement broker statistics collection
  - Add namespace bundle assignment retrieval
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11.1 Write property test for broker information completeness
  - **Property 19: Broker information completeness**
  - **Validates: Requirements 7.1**

- [ ] 11.2 Write property test for broker statistics completeness
  - **Property 20: Broker statistics completeness**
  - **Validates: Requirements 7.2**

- [ ] 12. Implement audit logging service
  - Create AuditService for writing audit events
  - Implement audit event creation for all mutations
  - Add query methods with filtering support
  - Implement export functionality
  - Ensure atomic persistence with primary operations
  - _Requirements: 3.5, 10.1, 10.2, 10.3, 10.5_

- [ ] 12.1 Write property test for audit event creation
  - **Property 29: Audit event creation for mutations**
  - **Validates: Requirements 10.1**

- [ ] 12.2 Write property test for audit event atomicity
  - **Property 33: Audit event atomicity**
  - **Validates: Requirements 10.5**

---

## Phase 4: API Routes

- [ ] 13. Implement FastAPI application with middleware
  - Enhance FastAPI app with proper middleware stack
  - Add request logging middleware with correlation IDs
  - Add error handling middleware with consistent error format
  - Enhance health check endpoint with dependency checks
  - Implement Prometheus metrics endpoint
  - _Requirements: 14.1, 14.3_

- [ ] 13.1 Define Pydantic models for all request/response types
  - Create models for Environment, Tenant, Namespace, Topic, Subscription, Broker, Audit
  - Add validation rules to models
  - _Requirements: 13.1_

- [ ] 13.2 Implement environment routes
  - GET /api/v1/environment - Get configuration
  - PUT /api/v1/environment - Update configuration
  - POST /api/v1/environment/test-connection - Test connectivity
  - _Requirements: 1.1, 1.2_

- [ ] 13.3 Implement tenant routes (replace mock data)
  - GET /api/v1/tenants - List tenants with statistics
  - POST /api/v1/tenants - Create tenant
  - GET /api/v1/tenants/{tenant} - Get tenant details
  - PUT /api/v1/tenants/{tenant} - Update tenant
  - DELETE /api/v1/tenants/{tenant} - Delete tenant
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 13.4 Implement namespace routes
  - GET /api/v1/tenants/{tenant}/namespaces - List namespaces
  - POST /api/v1/tenants/{tenant}/namespaces - Create namespace
  - GET /api/v1/tenants/{tenant}/namespaces/{namespace} - Get details
  - PUT /api/v1/tenants/{tenant}/namespaces/{namespace}/policies - Update policies
  - DELETE /api/v1/tenants/{tenant}/namespaces/{namespace} - Delete namespace
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 13.5 Implement topic routes
  - GET /api/v1/tenants/{tenant}/namespaces/{namespace}/topics - List topics
  - POST /api/v1/tenants/{tenant}/namespaces/{namespace}/topics - Create topic
  - GET /api/v1/topics/{topic} - Get topic details
  - GET /api/v1/topics/{topic}/stats - Get topic statistics
  - PUT /api/v1/topics/{topic}/partitions - Update partitions
  - DELETE /api/v1/topics/{topic} - Delete topic
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 13.6 Implement subscription routes
  - GET /api/v1/topics/{topic}/subscriptions - List subscriptions
  - POST /api/v1/topics/{topic}/subscriptions - Create subscription
  - GET /api/v1/topics/{topic}/subscriptions/{subscription} - Get details
  - POST /api/v1/topics/{topic}/subscriptions/{subscription}/reset - Reset cursor
  - POST /api/v1/topics/{topic}/subscriptions/{subscription}/skip - Skip messages
  - DELETE /api/v1/topics/{topic}/subscriptions/{subscription} - Delete subscription
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 13.7 Implement message browser routes
  - GET /api/v1/topics/{topic}/messages - Sample messages
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 13.8 Implement broker routes
  - GET /api/v1/brokers - List brokers
  - GET /api/v1/brokers/{broker}/stats - Get broker statistics
  - GET /api/v1/brokers/bundles - Get namespace bundles
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 13.9 Implement audit routes
  - GET /api/v1/audit - List audit events with filtering
  - GET /api/v1/audit/export - Export audit logs (CSV/JSON)
  - _Requirements: 10.3, 18.1_

- [ ] 13.10 Write property test for structured log completeness
  - **Property 39: Structured log completeness for requests**
  - **Validates: Requirements 14.1**

- [ ] 13.11 Write property test for error log correlation
  - **Property 41: Error log correlation**
  - **Validates: Requirements 14.4**

---

## Phase 5: Resilience & Background Worker

- [ ] 14. Implement error handling and resilience patterns
  - Add fallback to cached data when Pulsar API is unreachable
  - Implement database failure fallback to Redis cache
  - Add proper error responses for all failure scenarios
  - _Requirements: 15.1, 15.3, 15.4, 15.5_

- [ ] 14.1 Write property test for API error handling with cached data
  - **Property 34: API error handling with cached data**
  - **Validates: Requirements 11.2, 15.1**

- [ ] 14.2 Write property test for database failure fallback
  - **Property 46: Database failure fallback**
  - **Validates: Requirements 15.5**

- [ ] 15. Implement Celery worker for background tasks
  - Set up Celery with Redis as broker and result backend
  - Configure task routing and priorities
  - Implement task retry with exponential backoff
  - Add Prometheus metrics for task execution
  - _Requirements: 8.1, 14.2_

- [ ] 15.1 Implement topic statistics collection task
  - Create scheduled task (every 30 seconds)
  - Retrieve statistics for all topics via Pulsar Admin API
  - Batch insert to database using StatsRepository
  - _Requirements: 8.2_

- [ ] 15.2 Write property test for topic statistics collection completeness
  - **Property 21: Statistics collection completeness for topics**
  - **Validates: Requirements 8.2**

- [ ] 15.3 Implement subscription statistics collection task
  - Create scheduled task (every 30 seconds)
  - Retrieve statistics for all subscriptions via Pulsar Admin API
  - Batch insert to database using StatsRepository
  - _Requirements: 8.3_

- [ ] 15.4 Write property test for subscription statistics collection completeness
  - **Property 22: Statistics collection completeness for subscriptions**
  - **Validates: Requirements 8.3**

- [ ] 15.5 Implement broker statistics collection task
  - Create scheduled task (every 60 seconds)
  - Retrieve broker metrics via Pulsar Admin API
  - Store in database using StatsRepository
  - _Requirements: 7.2_

- [ ] 15.6 Implement aggregation computation task
  - Create scheduled task (every 60 seconds)
  - Compute tenant and namespace aggregations from statistics
  - Store precomputed results in AggregationRepository
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 15.7 Write property test for aggregation retry behavior
  - **Property 28: Aggregation retry with exponential backoff**
  - **Validates: Requirements 9.5**

- [ ] 15.8 Implement cleanup task
  - Create scheduled task (daily)
  - Delete statistics older than retention period
  - Vacuum database tables
  - _Requirements: 8.4_

- [ ] 15.9 Write property test for worker resilience
  - **Property 44: Worker resilience to collection failures**
  - **Validates: Requirements 15.3**

- [ ] 15.10 Write property test for structured log completeness for tasks
  - **Property 40: Structured log completeness for tasks**
  - **Validates: Requirements 14.2**

- [ ] 16. Checkpoint - Ensure all backend tests pass
  - Run full test suite
  - Ensure all property tests pass
  - Verify integration with real Pulsar cluster
  - Ask the user if questions arise

---

## Phase 6: Frontend Enhancement

- [x] 17. React application structure (ALREADY DONE)
  - React 19 + Vite + TypeScript configured
  - Tailwind CSS v4 working
  - React Router 7 set up
  - TanStack Query v5 integrated
  - Radix UI primitives installed
  - Lucide React icons available
  - _Requirements: 11.1, 12.1_

- [ ] 18. Generate OpenAPI client for frontend
  - Set up openapi-typescript-codegen or @hey-api/openapi-ts
  - Configure build script to generate TypeScript types from /openapi.json
  - Create API client wrapper with TanStack Query integration
  - Replace manual axios calls with generated client
  - _Requirements: 13.1, 13.2, 13.4_

- [ ] 19. Implement shared UI components
  - Create DataTable component with sorting, filtering, pagination
  - Create MetricCard component with trend indicators
  - Create ChartContainer component for Recharts
  - Create ConfirmDialog component for destructive actions
  - Create FormField component with validation display
  - Create LoadingSpinner component (enhance existing)
  - Create ErrorBoundary component
  - _Requirements: 11.4, 12.3, 12.4_

- [ ] 20. Implement Dashboard page
  - Create DashboardPage component
  - Display overview metrics (tenants, namespaces, topics, subscriptions)
  - Show cluster health status
  - Render charts for message rates and storage usage (Recharts)
  - Configure auto-refresh every 30 seconds with TanStack Query
  - _Requirements: 11.1_

- [ ] 21. Enhance Tenants page (replace mock data)
  - Connect to real backend API
  - Add search and filter functionality
  - Display aggregated statistics per tenant
  - Implement create/edit/delete actions with ConfirmDialog
  - Add navigation to namespace view
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 22. Implement Namespaces page
  - Create NamespacesPage component
  - List namespaces for selected tenant
  - Display policy configurations
  - Implement policy editing interface
  - Show namespace-level statistics
  - Add navigation to topics view
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 23. Implement Topics page
  - Create TopicsPage component
  - List topics for selected namespace
  - Support filtering by persistent/non-persistent
  - Display partition count, backlog, message rate
  - Implement topic creation and deletion
  - Add navigation to topic detail view
  - _Requirements: 4.1, 4.2, 4.5_

- [ ] 24. Implement Topic Detail page
  - Create TopicDetailPage component
  - Display detailed topic information
  - Show subscription list with backlog and consumer count
  - Implement message browser interface
  - Render time-series charts for throughput
  - _Requirements: 4.3, 6.1_

- [ ] 25. Implement Subscriptions page
  - Create SubscriptionsPage component
  - List subscriptions for selected topic
  - Display backlog, message rate, consumer count
  - Implement cursor reset and skip operations
  - Show consumer details
  - _Requirements: 5.1, 5.3, 5.4_

- [ ] 26. Enhance Brokers page (replace static data)
  - Connect to real backend API
  - List active brokers with service URLs
  - Display CPU, memory, connection metrics
  - Show namespace bundle assignments
  - Provide broker health indicators
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 27. Implement Audit Logs page
  - Create AuditLogsPage component
  - List audit events with filtering
  - Support time range selection
  - Provide search by resource and action type
  - Implement export to CSV/JSON
  - _Requirements: 10.3, 18.1, 18.2_

- [ ] 28. Implement error handling and resilience in UI
  - Add error boundary for component errors
  - Implement cached data display with staleness indicator
  - Add retry with exponential backoff for failed requests
  - Implement automatic recovery after connectivity restoration
  - _Requirements: 11.2, 11.5_

- [ ] 28.1 Write property test for UI optimistic updates
  - **Property 35: UI optimistic updates reconciliation**
  - **Validates: Requirements 11.3**

- [ ] 28.2 Write property test for UI recovery
  - **Property 36: UI recovery after connectivity restoration**
  - **Validates: Requirements 11.5**

- [ ] 29. Implement form validation and accessibility
  - Add validation feedback with error messages adjacent to fields
  - Ensure keyboard navigation works for all interactive elements
  - Add ARIA labels for screen reader compatibility
  - Implement loading states with skeleton loaders
  - Add non-color indicators for colorblind users
  - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [ ] 29.1 Write property test for form validation feedback
  - **Property 37: Form validation feedback**
  - **Validates: Requirements 12.3**

- [ ] 30. Implement data export functionality
  - Add export buttons to data tables
  - Implement CSV and JSON export formats
  - Apply current filters to exported data
  - Generate descriptive filenames with timestamp
  - Handle large exports with streaming
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 30.1 Write property test for export filter application
  - **Property 51: Export filter application**
  - **Validates: Requirements 18.2**

- [ ] 30.2 Write property test for subscription export completeness
  - **Property 52: Subscription export completeness**
  - **Validates: Requirements 18.3**

- [ ] 30.3 Write property test for large export streaming
  - **Property 53: Large export streaming**
  - **Validates: Requirements 18.4**

- [ ] 30.4 Write property test for export filename descriptiveness
  - **Property 54: Export filename descriptiveness**
  - **Validates: Requirements 18.5**

---

## Phase 7: Observability & Deployment

- [ ] 31. Implement OpenTelemetry integration
  - Add OpenTelemetry SDK to backend
  - Configure trace propagation from UI through API to Pulsar
  - Add span creation for all service methods
  - Configure trace export to collector
  - _Requirements: 14.5_

- [ ] 31.1 Write property test for distributed trace connectivity
  - **Property 42: Distributed trace connectivity**
  - **Validates: Requirements 14.5**

- [ ] 32. Create Docker images and Docker Compose
  - Create Dockerfile for UI (multi-stage build with Nginx)
  - Create Dockerfile for API (Python with Uvicorn)
  - Create Dockerfile for Worker (Python with Celery)
  - Create docker-compose.yml with all services
  - Add health checks to all containers
  - _Requirements: 17.1_

- [ ] 33. Create Kubernetes Helm chart
  - Create Helm chart structure
  - Define deployments for UI, API, Worker
  - Define StatefulSets for PostgreSQL and Redis
  - Create services for all components
  - Create Ingress with TLS configuration
  - Create ConfigMaps and Secrets
  - Create NetworkPolicies
  - _Requirements: 17.1, 17.2, 17.3, 17.5_

- [ ] 33.1 Write property test for horizontal scaling
  - **Property 50: Horizontal scaling state sharing**
  - **Validates: Requirements 17.2**

- [ ] 34. Set up observability stack
  - Configure Prometheus metrics collection
  - Create Grafana dashboards for overview, API, worker, resources
  - Set up Loki for log aggregation (optional)
  - Create alerting rules for critical conditions
  - _Requirements: 14.3_

- [ ] 35. Final checkpoint - Ensure all tests pass
  - Run complete test suite (unit, property, integration)
  - Verify all 54 correctness properties
  - Test end-to-end with real Pulsar cluster
  - Performance testing with Locust
  - Accessibility testing with Playwright
  - Ask the user if questions arise

---

## Task Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Backend Infrastructure | 11 tasks | 0% complete |
| Phase 2: Cache & Pulsar Client | 5 tasks | 0% complete |
| Phase 3: Core Services | 24 tasks | 0% complete |
| Phase 4: API Routes | 12 tasks | 0% complete |
| Phase 5: Resilience & Worker | 13 tasks | 0% complete |
| Phase 6: Frontend Enhancement | 19 tasks | 5% complete (1/19) |
| Phase 7: Observability & Deployment | 6 tasks | 0% complete |
| **Total** | **90 tasks** | **~1% complete** |

### Property Tests Summary

54 correctness properties to implement across all phases:
- Core Management: 13 properties
- Message Browsing: 5 properties
- Monitoring & Statistics: 10 properties
- Audit & Observability: 14 properties
- Resilience: 8 properties
- Export: 4 properties
