"""Prometheus metrics for monitoring."""

from prometheus_client import Counter, Gauge, Histogram, Info

# Application info
APP_INFO = Info("pulsar_manager", "Pulsar Manager application info")

# HTTP metrics
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "HTTP requests currently in progress",
    ["method", "endpoint"],
)

# Pulsar client metrics
PULSAR_REQUESTS_TOTAL = Counter(
    "pulsar_requests_total",
    "Total Pulsar admin API requests",
    ["method", "endpoint", "status"],
)

PULSAR_REQUEST_DURATION = Histogram(
    "pulsar_request_duration_seconds",
    "Pulsar admin API request duration",
    ["method", "endpoint"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

PULSAR_CIRCUIT_BREAKER_STATE = Gauge(
    "pulsar_circuit_breaker_state",
    "Pulsar circuit breaker state (0=closed, 1=open, 2=half-open)",
)

PULSAR_CIRCUIT_BREAKER_FAILURES = Counter(
    "pulsar_circuit_breaker_failures_total",
    "Total circuit breaker failure count",
)

# Cache metrics
CACHE_HITS = Counter(
    "cache_hits_total",
    "Total cache hits",
    ["cache_type"],
)

CACHE_MISSES = Counter(
    "cache_misses_total",
    "Total cache misses",
    ["cache_type"],
)

CACHE_OPERATIONS_DURATION = Histogram(
    "cache_operation_duration_seconds",
    "Cache operation duration",
    ["operation"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
)

# Database metrics
DB_CONNECTIONS_IN_USE = Gauge(
    "db_connections_in_use",
    "Database connections currently in use",
)

DB_QUERY_DURATION = Histogram(
    "db_query_duration_seconds",
    "Database query duration",
    ["query_type"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# Worker metrics
WORKER_TASKS_TOTAL = Counter(
    "worker_tasks_total",
    "Total worker tasks executed",
    ["task_name", "status"],
)

WORKER_TASK_DURATION = Histogram(
    "worker_task_duration_seconds",
    "Worker task duration",
    ["task_name"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
)

# Business metrics
TOPICS_TOTAL = Gauge(
    "pulsar_topics_total",
    "Total number of topics",
    ["tenant", "namespace"],
)

SUBSCRIPTIONS_TOTAL = Gauge(
    "pulsar_subscriptions_total",
    "Total number of subscriptions",
    ["tenant", "namespace"],
)

MESSAGES_BACKLOG = Gauge(
    "pulsar_messages_backlog",
    "Total message backlog",
    ["tenant", "namespace"],
)

MSG_RATE_IN = Gauge(
    "pulsar_msg_rate_in",
    "Message rate in per second",
    ["tenant", "namespace"],
)

MSG_RATE_OUT = Gauge(
    "pulsar_msg_rate_out",
    "Message rate out per second",
    ["tenant", "namespace"],
)


def init_app_info(version: str, environment: str) -> None:
    """Initialize application info metric."""
    APP_INFO.info({
        "version": version,
        "environment": environment,
    })
