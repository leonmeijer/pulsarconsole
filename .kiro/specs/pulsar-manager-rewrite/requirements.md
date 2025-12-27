# Requirements Document

## Introduction

This document specifies the requirements for a modern reimplementation of Apache Pulsar Manager - a web-based GUI management and monitoring tool for Apache Pulsar distributed pub-sub messaging systems. The new implementation will use Python/FastAPI for the backend and React 19 for the frontend, replacing the original Java/Spring Boot and Vue.js 2.7 stack. The system will provide comprehensive cluster management, real-time monitoring, and administrative capabilities for a single Pulsar environment without authentication requirements.

## Glossary

- **Pulsar**: Apache Pulsar distributed pub-sub messaging system
- **Control Plane API**: The Python/FastAPI backend service that manages Pulsar interactions
- **Web UI**: The React-based single-page application for user interaction
- **Tenant**: A Pulsar administrative unit for multi-tenancy isolation
- **Namespace**: A logical grouping of topics within a tenant
- **Topic**: A named channel for publishing and consuming messages
- **Subscription**: A named cursor that tracks message consumption progress
- **Broker**: A Pulsar server node that handles message routing
- **Partition**: A subdivision of a topic for parallel processing
- **Backlog**: Unconsumed messages in a subscription
- **Admin REST API**: Pulsar's native HTTP API for administrative operations
- **Message Browser**: A read-only interface for sampling topic messages
- **Worker**: Background process for periodic data collection and aggregation
- **Datastore**: PostgreSQL database for configuration and cached metrics
- **Cache Layer**: Redis-based caching for performance optimization

## Requirements

### Requirement 1

**User Story:** As a Pulsar administrator, I want to manage the Pulsar cluster environment configuration, so that the system can connect to and interact with my Pulsar deployment.

#### Acceptance Criteria

1. WHEN the system starts THEN the Control Plane API SHALL load environment configuration including admin service URL and authentication credentials from the Datastore
2. WHEN environment configuration is updated THEN the Control Plane API SHALL validate connectivity to the Pulsar Admin REST API before persisting changes
3. WHEN the Control Plane API receives a request THEN the system SHALL route it to the configured Pulsar cluster endpoint
4. WHEN authentication credentials are stored THEN the system SHALL encrypt sensitive values in the Datastore
5. THE Control Plane API SHALL maintain a connection pool to the Pulsar Admin REST API with configurable timeout and retry settings

### Requirement 2

**User Story:** As a Pulsar administrator, I want to view and manage tenants, so that I can organize resources and enforce multi-tenancy isolation.

#### Acceptance Criteria

1. WHEN a user requests the tenant list THEN the Control Plane API SHALL retrieve all tenants from the Pulsar Admin REST API and return them to the Web UI
2. WHEN a user creates a new tenant THEN the Control Plane API SHALL validate the tenant name format and submit the creation request to the Pulsar Admin REST API
3. WHEN a user updates tenant configuration THEN the Control Plane API SHALL apply the changes via the Pulsar Admin REST API and verify the update succeeded
4. WHEN a user deletes a tenant THEN the Control Plane API SHALL check for dependent namespaces and prevent deletion if dependencies exist
5. WHEN tenant operations complete THEN the Control Plane API SHALL invalidate relevant cache entries in the Cache Layer

### Requirement 3

**User Story:** As a Pulsar administrator, I want to view and manage namespaces within tenants, so that I can organize topics and apply policies at the namespace level.

#### Acceptance Criteria

1. WHEN a user requests namespaces for a tenant THEN the Control Plane API SHALL retrieve the namespace list from the Pulsar Admin REST API and include policy information
2. WHEN a user creates a namespace THEN the Control Plane API SHALL validate the namespace name format and create it under the specified tenant via the Pulsar Admin REST API
3. WHEN a user configures namespace policies THEN the Control Plane API SHALL apply retention, TTL, backlog quota, and dispatch rate settings via the Pulsar Admin REST API
4. WHEN a user deletes a namespace THEN the Control Plane API SHALL verify no topics exist and execute deletion via the Pulsar Admin REST API
5. WHEN namespace configuration changes THEN the Control Plane API SHALL audit log the operation with principal, action, resource, and timestamp

### Requirement 4

**User Story:** As a Pulsar administrator, I want to view and manage topics, so that I can create message channels and monitor their operational status.

#### Acceptance Criteria

1. WHEN a user requests topics for a namespace THEN the Control Plane API SHALL retrieve both persistent and non-persistent topics from the Pulsar Admin REST API
2. WHEN a user creates a topic THEN the Control Plane API SHALL validate the topic name and partition count, then create it via the Pulsar Admin REST API
3. WHEN a user requests topic details THEN the Control Plane API SHALL return partition information, subscription list, backlog size, and message rate statistics
4. WHEN a user updates topic partitions THEN the Control Plane API SHALL execute partition expansion via the Pulsar Admin REST API and prevent partition reduction
5. WHEN a user deletes a topic THEN the Control Plane API SHALL verify all subscriptions are deleted first, then remove the topic via the Pulsar Admin REST API

### Requirement 5

**User Story:** As a Pulsar administrator, I want to view and manage subscriptions, so that I can monitor consumer progress and troubleshoot message consumption issues.

#### Acceptance Criteria

1. WHEN a user requests subscriptions for a topic THEN the Control Plane API SHALL retrieve subscription details including backlog, message rate, and consumer count from the Pulsar Admin REST API
2. WHEN a user creates a subscription THEN the Control Plane API SHALL validate the subscription name and initial position, then create it via the Pulsar Admin REST API
3. WHEN a user resets a subscription cursor THEN the Control Plane API SHALL execute the reset operation to the specified message ID or timestamp via the Pulsar Admin REST API
4. WHEN a user skips messages in a subscription THEN the Control Plane API SHALL advance the cursor by the specified count via the Pulsar Admin REST API
5. WHEN a user deletes a subscription THEN the Control Plane API SHALL remove it via the Pulsar Admin REST API and clear associated cached statistics

### Requirement 6

**User Story:** As a Pulsar administrator, I want to browse messages in topics, so that I can inspect message content for debugging and validation purposes.

#### Acceptance Criteria

1. WHEN a user requests message browsing THEN the Control Plane API SHALL create a Pulsar Python Client reader with read-only access to the specified topic
2. WHEN sampling messages THEN the system SHALL enforce a maximum message count limit per request to prevent resource exhaustion
3. WHEN sampling messages THEN the system SHALL enforce a maximum payload size limit per message to prevent memory issues
4. WHEN message browsing is active THEN the system SHALL apply rate limiting per user session to prevent abuse
5. WHEN messages are retrieved THEN the Control Plane API SHALL return message ID, publish timestamp, properties, and payload without modifying topic state

### Requirement 7

**User Story:** As a Pulsar administrator, I want to view broker information and statistics, so that I can monitor cluster health and resource utilization.

#### Acceptance Criteria

1. WHEN a user requests broker list THEN the Control Plane API SHALL retrieve active brokers from the Pulsar Admin REST API with their service URLs and versions
2. WHEN a user requests broker statistics THEN the Control Plane API SHALL return CPU usage, memory usage, message rate, and connection count for each broker
3. WHEN a user requests namespace bundles THEN the Control Plane API SHALL retrieve bundle assignments and load distribution from the Pulsar Admin REST API
4. WHEN broker metrics are displayed THEN the Web UI SHALL refresh statistics at configurable intervals without full page reload
5. WHEN broker health checks fail THEN the Control Plane API SHALL log the failure and return degraded status to the Web UI

### Requirement 8

**User Story:** As a Pulsar administrator, I want the system to periodically collect and cache metrics, so that the UI can display statistics quickly without overloading the Pulsar cluster.

#### Acceptance Criteria

1. WHEN the Worker process starts THEN the system SHALL schedule periodic collection tasks for topic statistics, subscription statistics, and broker metrics
2. WHEN collecting topic statistics THEN the Worker SHALL retrieve message rates, storage size, and backlog for all topics via the Pulsar Admin REST API
3. WHEN collecting subscription statistics THEN the Worker SHALL retrieve consumer count, backlog, and message rate for all subscriptions via the Pulsar Admin REST API
4. WHEN statistics are collected THEN the Worker SHALL persist snapshots to the Datastore with timestamp and environment identifier
5. WHEN the Web UI requests statistics THEN the Control Plane API SHALL serve cached data from the Datastore with cache age metadata

### Requirement 9

**User Story:** As a Pulsar administrator, I want to view aggregated statistics across tenants and namespaces, so that I can understand resource usage patterns and plan capacity.

#### Acceptance Criteria

1. WHEN a user requests tenant-level statistics THEN the Control Plane API SHALL aggregate topic counts, total backlog, and message rates across all namespaces in the tenant
2. WHEN a user requests namespace-level statistics THEN the Control Plane API SHALL aggregate topic counts, storage size, and throughput for all topics in the namespace
3. WHEN computing aggregations THEN the Worker SHALL precompute common aggregations during periodic collection to minimize query latency
4. WHEN aggregated data is requested THEN the Control Plane API SHALL return results within 500 milliseconds using precomputed values from the Datastore
5. WHEN aggregation computation fails THEN the Worker SHALL log the error and retry with exponential backoff up to three attempts

### Requirement 10

**User Story:** As a Pulsar administrator, I want all administrative actions to be logged, so that I can audit changes and troubleshoot issues.

#### Acceptance Criteria

1. WHEN any create, update, or delete operation is executed THEN the Control Plane API SHALL write an audit event to the Datastore before returning the response
2. WHEN an audit event is created THEN the system SHALL record the action type, resource identifier, request parameters, timestamp, and operation status
3. WHEN a user requests audit logs THEN the Control Plane API SHALL return events filtered by time range, resource type, and action type
4. WHEN audit log queries execute THEN the system SHALL use indexed queries on the Datastore to return results within 1 second for typical time ranges
5. WHEN audit events are written THEN the system SHALL ensure atomic persistence with the primary operation or mark the audit as failed

### Requirement 11

**User Story:** As a Pulsar administrator, I want the Web UI to provide real-time updates for metrics and status, so that I can monitor the system without manual refresh.

#### Acceptance Criteria

1. WHEN a user views a dashboard page THEN the Web UI SHALL use TanStack Query to automatically refresh data at configured intervals
2. WHEN the Control Plane API is unreachable THEN the Web UI SHALL display cached data with a staleness indicator and retry with exponential backoff
3. WHEN data updates arrive THEN the Web UI SHALL use optimistic updates for user actions and reconcile with server responses
4. WHEN displaying time-series metrics THEN the Web UI SHALL render charts using efficient visualization libraries with automatic scaling
5. WHEN network connectivity is restored THEN the Web UI SHALL automatically resume data fetching and clear error indicators

### Requirement 12

**User Story:** As a Pulsar administrator, I want the Web UI to be responsive and accessible, so that I can manage Pulsar from various devices and screen sizes.

#### Acceptance Criteria

1. WHEN the Web UI renders THEN the system SHALL use Tailwind CSS responsive utilities to adapt layouts for mobile, tablet, and desktop viewports
2. WHEN interactive elements are rendered THEN the Web UI SHALL use Radix UI primitives to ensure keyboard navigation and screen reader compatibility
3. WHEN forms are displayed THEN the Web UI SHALL provide clear validation feedback with error messages adjacent to invalid fields
4. WHEN loading states occur THEN the Web UI SHALL display skeleton loaders or progress indicators to communicate system activity
5. WHEN color is used to convey information THEN the Web UI SHALL provide additional non-color indicators to support colorblind users

### Requirement 13

**User Story:** As a developer, I want the Control Plane API to expose an OpenAPI specification, so that API clients can be generated automatically with type safety.

#### Acceptance Criteria

1. WHEN the Control Plane API starts THEN FastAPI SHALL automatically generate an OpenAPI 3.0 specification from route definitions and Pydantic models
2. WHEN the OpenAPI specification is accessed THEN the system SHALL serve it at the standard /openapi.json endpoint
3. WHEN API models change THEN the OpenAPI specification SHALL reflect the changes automatically without manual documentation updates
4. WHEN the Web UI is built THEN the build process SHALL generate TypeScript types and API client functions from the OpenAPI specification
5. WHEN API requests are made THEN the generated client SHALL provide compile-time type checking for request parameters and response data

### Requirement 14

**User Story:** As a system operator, I want the Control Plane API and Worker to emit structured logs and metrics, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. WHEN the Control Plane API processes requests THEN the system SHALL emit structured JSON logs with request ID, endpoint, duration, and status code
2. WHEN the Worker executes background tasks THEN the system SHALL emit logs with task name, execution duration, success status, and error details
3. WHEN the system emits metrics THEN the Control Plane API SHALL expose Prometheus-compatible metrics at the /metrics endpoint
4. WHEN errors occur THEN the system SHALL log stack traces with correlation IDs that link related log entries across services
5. WHEN the system integrates with OpenTelemetry THEN distributed traces SHALL connect Web UI requests through Control Plane API to Pulsar Admin REST API calls

### Requirement 15

**User Story:** As a system operator, I want the system to handle Pulsar cluster failures gracefully, so that temporary outages do not crash the application.

#### Acceptance Criteria

1. WHEN the Pulsar Admin REST API is unreachable THEN the Control Plane API SHALL return cached data with a staleness indicator rather than failing the request
2. WHEN Pulsar Admin REST API requests timeout THEN the Control Plane API SHALL retry with exponential backoff up to three attempts before returning an error
3. WHEN the Worker cannot collect metrics THEN the system SHALL log the failure and continue with the next scheduled collection without crashing
4. WHEN connection pool exhaustion occurs THEN the Control Plane API SHALL queue requests and return 503 Service Unavailable with retry-after headers
5. WHEN the Datastore is unavailable THEN the Control Plane API SHALL serve read-only cached data from the Cache Layer and reject write operations with clear error messages

### Requirement 16

**User Story:** As a developer, I want the system to use a consistent data access pattern, so that database interactions are maintainable and testable.

#### Acceptance Criteria

1. WHEN the Control Plane API accesses the Datastore THEN the system SHALL use a repository pattern with abstract interfaces for data operations
2. WHEN database queries execute THEN the system SHALL use parameterized queries to prevent SQL injection vulnerabilities
3. WHEN database transactions are required THEN the system SHALL use explicit transaction boundaries with rollback on error
4. WHEN the Worker writes statistics THEN the system SHALL use batch inserts to minimize database round trips and improve throughput
5. WHEN database schema changes are needed THEN the system SHALL use migration tools to version and apply schema changes consistently

### Requirement 17

**User Story:** As a system operator, I want the system to be deployable on Kubernetes, so that I can leverage container orchestration for scaling and reliability.

#### Acceptance Criteria

1. WHEN the system is deployed THEN the deployment SHALL include Helm charts for the Web UI, Control Plane API, Worker, PostgreSQL, and Redis components
2. WHEN the Control Plane API scales horizontally THEN multiple instances SHALL share state via the Cache Layer and Datastore without conflicts
3. WHEN configuration changes are needed THEN the system SHALL load settings from Kubernetes ConfigMaps and Secrets without requiring image rebuilds
4. WHEN the system is deployed in airgapped environments THEN all dependencies SHALL be vendored and container images SHALL be available in private registries
5. WHEN network policies are applied THEN the Control Plane API and Worker SHALL have network access to Pulsar clusters while the Web UI SHALL not

### Requirement 18

**User Story:** As a Pulsar administrator, I want to export data from the Web UI, so that I can analyze metrics offline or share reports with stakeholders.

#### Acceptance Criteria

1. WHEN a user requests data export THEN the Web UI SHALL provide options to export in CSV and JSON formats
2. WHEN exporting topic statistics THEN the system SHALL include all visible columns and apply current filters to the exported data
3. WHEN exporting subscription data THEN the system SHALL include backlog, message rate, consumer count, and timestamp information
4. WHEN large exports are requested THEN the Control Plane API SHALL stream the response to prevent memory exhaustion
5. WHEN export operations complete THEN the Web UI SHALL trigger a browser download with a descriptive filename including timestamp and resource type
