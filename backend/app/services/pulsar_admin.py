"""Pulsar Admin API client wrapper with retry logic and circuit breaker."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import httpx

from app.config import settings
from app.core.exceptions import PulsarConnectionError, NotFoundError, ValidationError
from app.core.logging import get_logger

logger = get_logger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    """Simple circuit breaker implementation."""

    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    half_open_max_calls: int = 1

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: datetime | None = None
    half_open_calls: int = 0

    def record_success(self) -> None:
        """Record a successful call."""
        self.failure_count = 0
        self.half_open_calls = 0
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info("Circuit breaker closed")

    def record_failure(self) -> None:
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now(timezone.utc)

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            logger.warning("Circuit breaker opened after half-open failure")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(
                "Circuit breaker opened",
                failure_count=self.failure_count,
                threshold=self.failure_threshold,
            )

    def can_execute(self) -> bool:
        """Check if a call can be executed."""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = (
                    datetime.now(timezone.utc) - self.last_failure_time
                ).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    logger.info("Circuit breaker half-open")
                    return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False

        return False


class PulsarAdminService:
    """Service for interacting with Pulsar Admin REST API."""

    def __init__(
        self,
        admin_url: str | None = None,
        auth_token: str | None = None,
        environment_id: str | None = None,
    ) -> None:
        self.admin_url = (admin_url or settings.pulsar_admin_url).rstrip("/")
        self.auth_token = auth_token or settings.pulsar_auth_token
        self.environment_id = environment_id
        self.circuit_breaker = CircuitBreaker()

        # HTTP client configuration
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            headers = {"Accept": "application/json"}
            
            # Resolve token if it's a file reference
            token = self.auth_token
            if token and token.startswith("file://"):
                try:
                    path = token.replace("file://", "")
                    with open(path, "r") as f:
                        token = f.read().strip()
                except Exception as e:
                    logger.error(f"Failed to read token from file {token}: {e}")
                    # If reading fails, we'll continue without a token or let it fail at the broker
            
            if token:
                headers["Authorization"] = f"Bearer {token}"

            self._client = httpx.AsyncClient(
                base_url=self.admin_url,
                headers=headers,
                timeout=httpx.Timeout(
                    connect=settings.pulsar_connect_timeout,
                    read=settings.pulsar_read_timeout,
                    write=settings.pulsar_read_timeout,
                    pool=settings.pulsar_connect_timeout,
                ),
                limits=httpx.Limits(
                    max_keepalive_connections=5,
                    max_connections=10,
                    keepalive_expiry=30.0,
                ),
                verify=not settings.pulsar_tls_allow_insecure,
            )
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> httpx.Response:
        """Make HTTP request with retry logic and circuit breaker."""
        if not self.circuit_breaker.can_execute():
            raise PulsarConnectionError(
                "Circuit breaker is open",
                url=f"{self.admin_url}{path}",
            )

        client = await self._get_client()
        last_error: Exception | None = None

        for attempt in range(settings.pulsar_max_retries):
            try:
                response = await client.request(method, path, **kwargs)

                # Check for HTTP errors
                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"Server error: {response.status_code}",
                        request=response.request,
                        response=response,
                    )

                self.circuit_breaker.record_success()
                return response

            except (httpx.ConnectError, httpx.TimeoutException, httpx.ReadError, httpx.WriteError) as e:
                last_error = e
                self.circuit_breaker.record_failure()
                logger.warning(
                    "Pulsar API request failed",
                    attempt=attempt + 1,
                    max_retries=settings.pulsar_max_retries,
                    path=path,
                    error_type=type(e).__name__,
                    error=str(e),
                )

                if attempt < settings.pulsar_max_retries - 1:
                    # Exponential backoff: 1s, 2s, 4s
                    await asyncio.sleep(2**attempt)

            except httpx.HTTPStatusError as e:
                if e.response.status_code in (502, 503, 504):
                    last_error = e
                    self.circuit_breaker.record_failure()
                    if attempt < settings.pulsar_max_retries - 1:
                        await asyncio.sleep(2**attempt)
                else:
                    # Don't retry for 4xx errors
                    self.circuit_breaker.record_success()
                    raise

        raise PulsarConnectionError(
            f"Failed after {settings.pulsar_max_retries} retries",
            url=f"{self.admin_url}{path}",
            original_error=last_error,
        )

    def _handle_response(self, response: httpx.Response, resource_type: str = "resource") -> Any:
        """Handle response and convert errors."""
        if response.status_code == 404:
            raise NotFoundError(resource_type, response.url.path)
        if response.status_code == 409:
            try:
                error = response.json()
                message = error.get("reason", "Conflict")
            except Exception:
                message = response.text
            raise ValidationError(message)
        if response.status_code >= 400:
            try:
                error = response.json()
                message = error.get("reason", response.text)
            except Exception:
                message = response.text
            raise PulsarConnectionError(message, url=str(response.url))

        if response.status_code == 204:
            return None

        try:
            return response.json()
        except Exception:
            return response.text

    # -------------------------------------------------------------------------
    # Cluster operations
    # -------------------------------------------------------------------------

    async def get_clusters(self) -> list[str]:
        """Get list of clusters."""
        response = await self._request("GET", "/admin/v2/clusters")
        return self._handle_response(response, "clusters")

    async def get_cluster(self, cluster: str) -> dict[str, Any]:
        """Get cluster info."""
        response = await self._request("GET", f"/admin/v2/clusters/{cluster}")
        return self._handle_response(response, "cluster")

    # -------------------------------------------------------------------------
    # Tenant operations
    # -------------------------------------------------------------------------

    async def get_tenants(self) -> list[str]:
        """Get list of tenants."""
        response = await self._request("GET", "/admin/v2/tenants")
        return self._handle_response(response, "tenants")

    async def get_tenant(self, tenant: str) -> dict[str, Any]:
        """Get tenant info."""
        response = await self._request("GET", f"/admin/v2/tenants/{tenant}")
        return self._handle_response(response, "tenant")

    async def create_tenant(
        self,
        tenant: str,
        admin_roles: list[str] | None = None,
        allowed_clusters: list[str] | None = None,
    ) -> None:
        """Create a new tenant."""
        data = {
            "adminRoles": admin_roles or [],
            "allowedClusters": allowed_clusters or [],
        }
        response = await self._request(
            "PUT",
            f"/admin/v2/tenants/{tenant}",
            json=data,
        )
        self._handle_response(response, "tenant")

    async def update_tenant(
        self,
        tenant: str,
        admin_roles: list[str] | None = None,
        allowed_clusters: list[str] | None = None,
    ) -> None:
        """Update tenant configuration."""
        data = {}
        if admin_roles is not None:
            data["adminRoles"] = admin_roles
        if allowed_clusters is not None:
            data["allowedClusters"] = allowed_clusters

        response = await self._request(
            "POST",
            f"/admin/v2/tenants/{tenant}",
            json=data,
        )
        self._handle_response(response, "tenant")

    async def delete_tenant(self, tenant: str) -> None:
        """Delete a tenant."""
        response = await self._request("DELETE", f"/admin/v2/tenants/{tenant}")
        self._handle_response(response, "tenant")

    # -------------------------------------------------------------------------
    # Namespace operations
    # -------------------------------------------------------------------------

    async def get_namespaces(self, tenant: str) -> list[str]:
        """Get namespaces for a tenant."""
        response = await self._request("GET", f"/admin/v2/namespaces/{tenant}")
        return self._handle_response(response, "namespaces")

    async def get_namespace_policies(self, tenant: str, namespace: str) -> dict[str, Any]:
        """Get namespace policies."""
        response = await self._request(
            "GET",
            f"/admin/v2/namespaces/{tenant}/{namespace}",
        )
        return self._handle_response(response, "namespace")

    async def create_namespace(self, tenant: str, namespace: str) -> None:
        """Create a new namespace."""
        response = await self._request(
            "PUT",
            f"/admin/v2/namespaces/{tenant}/{namespace}",
        )
        self._handle_response(response, "namespace")

    async def delete_namespace(self, tenant: str, namespace: str) -> None:
        """Delete a namespace."""
        response = await self._request(
            "DELETE",
            f"/admin/v2/namespaces/{tenant}/{namespace}",
        )
        self._handle_response(response, "namespace")

    async def set_retention(
        self,
        tenant: str,
        namespace: str,
        retention_time_minutes: int,
        retention_size_mb: int,
    ) -> None:
        """Set retention policy for namespace."""
        data = {
            "retentionTimeInMinutes": retention_time_minutes,
            "retentionSizeInMB": retention_size_mb,
        }
        response = await self._request(
            "POST",
            f"/admin/v2/namespaces/{tenant}/{namespace}/retention",
            json=data,
        )
        self._handle_response(response, "namespace")

    async def set_message_ttl(
        self,
        tenant: str,
        namespace: str,
        ttl_seconds: int,
    ) -> None:
        """Set message TTL for namespace."""
        response = await self._request(
            "POST",
            f"/admin/v2/namespaces/{tenant}/{namespace}/messageTTL",
            json=ttl_seconds,
        )
        self._handle_response(response, "namespace")

    async def set_deduplication(
        self,
        tenant: str,
        namespace: str,
        enabled: bool,
    ) -> None:
        """Set deduplication for namespace."""
        response = await self._request(
            "POST",
            f"/admin/v2/namespaces/{tenant}/{namespace}/deduplication",
            json=enabled,
        )
        self._handle_response(response, "namespace")

    async def set_schema_compatibility_strategy(
        self,
        tenant: str,
        namespace: str,
        strategy: str,
    ) -> None:
        """Set schema compatibility strategy for namespace."""
        response = await self._request(
            "PUT",
            f"/admin/v2/namespaces/{tenant}/{namespace}/schemaCompatibilityStrategy",
            json=strategy,
        )
        self._handle_response(response, "namespace")

    # -------------------------------------------------------------------------
    # Topic operations
    # -------------------------------------------------------------------------

    async def get_topics(
        self,
        tenant: str,
        namespace: str,
        persistent: bool = True,
    ) -> list[str]:
        """Get topics for a namespace."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}",
        )
        return self._handle_response(response, "topics")

    async def get_partitioned_topics(
        self,
        tenant: str,
        namespace: str,
        persistent: bool = True,
    ) -> list[str]:
        """Get partitioned topics for a namespace."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/partitioned",
        )
        return self._handle_response(response, "topics")

    async def get_topic_stats(self, topic: str) -> dict[str, Any]:
        """Get topic statistics."""
        # Parse topic name: persistent://tenant/namespace/topic
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/stats",
        )
        return self._handle_response(response, "topic")

    async def create_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Create a non-partitioned topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}",
        )
        self._handle_response(response, "topic")

    async def create_partitioned_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        partitions: int,
        persistent: bool = True,
    ) -> None:
        """Create a partitioned topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/partitions",
            json=partitions,
        )
        self._handle_response(response, "topic")

    async def update_partitions(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        partitions: int,
        persistent: bool = True,
    ) -> None:
        """Update partition count (expansion only)."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/partitions",
            json=partitions,
        )
        self._handle_response(response, "topic")

    async def delete_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
        force: bool = False,
    ) -> None:
        """Delete a topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        params = {"force": str(force).lower()}
        response = await self._request(
            "DELETE",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}",
            params=params,
        )
        self._handle_response(response, "topic")

    # -------------------------------------------------------------------------
    # Subscription operations
    # -------------------------------------------------------------------------

    async def get_subscriptions(self, topic: str) -> list[str]:
        """Get subscriptions for a topic."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscriptions",
        )
        return self._handle_response(response, "subscriptions")

    async def create_subscription(
        self,
        topic: str,
        subscription: str,
        position: str = "latest",
        replicated: bool = False,
    ) -> None:
        """Create a subscription."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        params = {
            "initialPosition": position,
            "replicated": str(replicated).lower(),
        }
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscription/{subscription}",
            params=params,
        )
        self._handle_response(response, "subscription")

    async def delete_subscription(
        self, topic: str, subscription: str, force: bool = False
    ) -> None:
        """Delete a subscription."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        params = {"force": str(force).lower()}
        response = await self._request(
            "DELETE",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscription/{subscription}",
            params=params,
        )
        self._handle_response(response, "subscription")

    async def reset_cursor(
        self,
        topic: str,
        subscription: str,
        timestamp: int,
    ) -> None:
        """Reset subscription cursor to timestamp."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscription/{subscription}/resetcursor/{timestamp}",
        )
        self._handle_response(response, "subscription")

    async def skip_messages(
        self,
        topic: str,
        subscription: str,
        count: int,
    ) -> None:
        """Skip messages in subscription."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscription/{subscription}/skip/{count}",
        )
        self._handle_response(response, "subscription")

    # -------------------------------------------------------------------------
    # Namespace Permission operations
    # -------------------------------------------------------------------------

    async def get_namespace_permissions(
        self,
        tenant: str,
        namespace: str,
    ) -> dict[str, list[str]]:
        """Get permissions for a namespace.

        Returns a dict mapping roles to their permissions (produce, consume, functions, etc).
        """
        response = await self._request(
            "GET",
            f"/admin/v2/namespaces/{tenant}/{namespace}/permissions",
        )
        return self._handle_response(response, "namespace-permissions")

    async def grant_namespace_permission(
        self,
        tenant: str,
        namespace: str,
        role: str,
        actions: list[str],
    ) -> None:
        """Grant permissions to a role on a namespace.

        Args:
            tenant: Tenant name
            namespace: Namespace name
            role: Role to grant permissions to
            actions: List of actions to grant (produce, consume, functions, packages, sinks, sources)
        """
        response = await self._request(
            "POST",
            f"/admin/v2/namespaces/{tenant}/{namespace}/permissions/{role}",
            json=actions,
        )
        self._handle_response(response, "namespace-permissions")

    async def revoke_namespace_permission(
        self,
        tenant: str,
        namespace: str,
        role: str,
    ) -> None:
        """Revoke all permissions from a role on a namespace."""
        response = await self._request(
            "DELETE",
            f"/admin/v2/namespaces/{tenant}/{namespace}/permissions/{role}",
        )
        self._handle_response(response, "namespace-permissions")

    # -------------------------------------------------------------------------
    # Topic Permission operations
    # -------------------------------------------------------------------------

    async def get_topic_permissions(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> dict[str, list[str]]:
        """Get permissions for a topic.

        Returns a dict mapping roles to their permissions.
        """
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/permissions",
        )
        return self._handle_response(response, "topic-permissions")

    async def grant_topic_permission(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        role: str,
        actions: list[str],
        persistent: bool = True,
    ) -> None:
        """Grant permissions to a role on a topic.

        Args:
            tenant: Tenant name
            namespace: Namespace name
            topic: Topic name
            role: Role to grant permissions to
            actions: List of actions to grant (produce, consume)
            persistent: Whether the topic is persistent
        """
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/permissions/{role}",
            json=actions,
        )
        self._handle_response(response, "topic-permissions")

    async def revoke_topic_permission(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        role: str,
        persistent: bool = True,
    ) -> None:
        """Revoke all permissions from a role on a topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "DELETE",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/permissions/{role}",
        )
        self._handle_response(response, "topic-permissions")

    # -------------------------------------------------------------------------
    # Broker operations
    # -------------------------------------------------------------------------

    async def get_brokers(self, cluster: str | None = None) -> list[str]:
        """Get active brokers."""
        cluster = cluster or settings.pulsar_cluster
        response = await self._request("GET", f"/admin/v2/brokers/{cluster}")
        return self._handle_response(response, "brokers")

    async def get_active_brokers(self, cluster: str | None = None) -> list[str]:
        """Alias for get_brokers for backwards compatibility."""
        return await self.get_brokers(cluster)

    async def get_broker_stats(self, broker_url: str | None = None) -> dict[str, Any]:
        """Get broker stats from Prometheus metrics endpoint."""
        try:
            client = await self._get_client()
            # Follow redirects for /metrics
            response = await client.get("/metrics", follow_redirects=True)
            if response.status_code != 200:
                return {}

            metrics_text = response.text
            stats = {
                'jvmHeapUsed': 0,
                'jvmHeapMax': 0,
                'directMemoryUsed': 0,
                'msgRateIn': 0.0,
                'msgRateOut': 0.0,
                'numTopics': 0,
                'numProducers': 0,
                'numConsumers': 0,
                'jvmThreads': 0,
                'processCpuSeconds': 0.0,
            }

            # Parse relevant metrics
            for line in metrics_text.split('\n'):
                if line.startswith('#') or not line.strip():
                    continue

                try:
                    # JVM Memory (heap used)
                    if 'jvm_memory_bytes_used{' in line and 'area="heap"' in line:
                        value = float(line.split()[-1])
                        stats['jvmHeapUsed'] = value

                    # JVM Memory (heap max)
                    elif 'jvm_memory_bytes_max{' in line and 'area="heap"' in line:
                        value = float(line.split()[-1])
                        if value > 0:  # -1 means unlimited
                            stats['jvmHeapMax'] = value

                    # Direct memory
                    elif line.startswith('jvm_memory_direct_bytes_used{'):
                        value = float(line.split()[-1])
                        stats['directMemoryUsed'] = value

                    # JVM Threads
                    elif line.startswith('jvm_threads_current{'):
                        value = int(float(line.split()[-1]))
                        stats['jvmThreads'] = value

                    # Process CPU seconds (cumulative)
                    elif line.startswith('process_cpu_seconds_total{'):
                        value = float(line.split()[-1])
                        stats['processCpuSeconds'] = value

                    # Broker-level message rates
                    elif line.startswith('pulsar_broker_rate_in{'):
                        value = float(line.split()[-1])
                        stats['msgRateIn'] = value

                    elif line.startswith('pulsar_broker_rate_out{'):
                        value = float(line.split()[-1])
                        stats['msgRateOut'] = value

                    # Broker counts
                    elif line.startswith('pulsar_broker_topics_count{'):
                        value = int(float(line.split()[-1]))
                        stats['numTopics'] = value

                    elif line.startswith('pulsar_broker_producers_count{'):
                        value = int(float(line.split()[-1]))
                        stats['numProducers'] = value

                    elif line.startswith('pulsar_broker_consumers_count{'):
                        value = int(float(line.split()[-1]))
                        stats['numConsumers'] = value

                except (ValueError, IndexError):
                    continue

            # Calculate memory percentage
            if stats['jvmHeapMax'] > 0:
                stats['memory'] = {'usage': (stats['jvmHeapUsed'] / stats['jvmHeapMax']) * 100}
            else:
                stats['memory'] = {'usage': 0}

            # Try to get actual CPU from load report
            try:
                load_report = await self.get_broker_load_report()
                cpu_data = load_report.get('cpu', {})
                stats['cpu'] = {'usage': cpu_data.get('usage', 0)}

                # Also get direct memory from load report if available
                direct_memory_data = load_report.get('directMemory', {})
                if direct_memory_data:
                    stats['directMemory'] = {'usage': direct_memory_data.get('usage', 0)}
                else:
                    # Fallback: Direct memory as percentage (assume 2GB limit if not known)
                    direct_mem = stats.get('directMemoryUsed', 0)
                    direct_limit = 2 * 1024 * 1024 * 1024  # 2GB default
                    stats['directMemory'] = {'usage': (direct_mem / direct_limit) * 100 if direct_limit > 0 else 0}
            except Exception:
                # Fallback: mark CPU as unavailable
                stats['cpu'] = {'usage': 0, 'unavailable': True}
                # Fallback: Direct memory as percentage (assume 2GB limit if not known)
                direct_mem = stats.get('directMemoryUsed', 0)
                direct_limit = 2 * 1024 * 1024 * 1024  # 2GB default
                stats['directMemory'] = {'usage': (direct_mem / direct_limit) * 100 if direct_limit > 0 else 0}

            return stats

        except Exception as e:
            logger.warning("Failed to get broker stats from metrics", error=str(e))
            return {}

    async def get_owned_namespaces(self, broker_url: str, cluster: str = "standalone") -> list[str]:
        """Get namespaces owned by a broker."""
        try:
            response = await self._request(
                "GET",
                f"/admin/v2/brokers/{cluster}/{broker_url}/ownedNamespaces",
            )
            data = self._handle_response(response, "namespaces")
            return list(data.keys()) if isinstance(data, dict) else data
        except Exception:
            return []

    async def get_broker_load(self, broker_url: str) -> dict[str, Any]:
        """Get load data for a specific broker."""
        # Load report includes data for the broker that responds
        return await self.get_broker_stats(broker_url)

    async def get_leader_broker(self) -> dict[str, Any]:
        """Get the leader broker info."""
        response = await self._request("GET", "/admin/v2/brokers/leaderBroker")
        return self._handle_response(response, "leader-broker")

    async def get_broker_load_report(self) -> dict[str, Any]:
        """Get broker load report with actual CPU/memory usage.

        This endpoint returns real resource usage metrics from the broker's
        load manager, including actual CPU and memory percentages.

        Returns:
            Load report dict with 'cpu', 'memory', 'directMemory' usage data.
        """
        response = await self._request("GET", "/admin/v2/broker-stats/load-report")
        return self._handle_response(response, "load-report")

    async def get_broker_configuration(self) -> dict[str, Any] | list[str]:
        """Get all broker configuration parameters.
        
        Note: In Pulsar 3.x, this returns a list of configuration names.
        Use get_broker_runtime_config() to get the effective values.
        """
        response = await self._request("GET", "/admin/v2/brokers/configuration")
        return self._handle_response(response, "configuration")

    async def get_broker_runtime_config(self) -> dict[str, Any]:
        """Get broker runtime configuration (effective config)."""
        response = await self._request("GET", "/admin/v2/brokers/configuration/runtime")
        return self._handle_response(response, "runtime-config")

    async def get_broker_internal_config(self) -> dict[str, Any]:
        """Get broker internal configuration."""
        response = await self._request("GET", "/admin/v2/brokers/internal-configuration")
        return self._handle_response(response, "internal-config")

    async def healthcheck(self) -> bool:
        """Check if Pulsar broker is healthy."""
        try:
            response = await self._request("GET", "/admin/v2/brokers/health")
            return response.status_code == 200
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # Broker Dynamic Configuration operations
    # -------------------------------------------------------------------------

    async def get_all_dynamic_config(self) -> dict[str, str]:
        """Get all dynamic broker configuration values.

        Returns all dynamic configuration values that have been set.
        """
        response = await self._request("GET", "/admin/v2/brokers/configuration/values")
        return self._handle_response(response, "dynamic-config")

    async def get_dynamic_config_names(self) -> list[str]:
        """Get all available dynamic configuration names."""
        # This endpoint returns a dictionary of all configuration parameters
        config = await self.get_broker_configuration()
        if isinstance(config, list):
            return config
        return list(config.keys()) if isinstance(config, dict) else []

    async def update_dynamic_config(
        self,
        config_name: str,
        config_value: str,
    ) -> None:
        """Update a dynamic broker configuration.

        Args:
            config_name: Name of the configuration
            config_value: Value to set
        """
        response = await self._request(
            "POST",
            f"/admin/v2/brokers/configuration/{config_name}/{config_value}",
        )
        self._handle_response(response, "dynamic-config")

    async def delete_dynamic_config(self, config_name: str) -> None:
        """Delete/reset a dynamic broker configuration to default."""
        response = await self._request(
            "DELETE",
            f"/admin/v2/brokers/configuration/{config_name}",
        )
        self._handle_response(response, "dynamic-config")

    async def get_auth_status(self) -> dict[str, Any]:
        """Get current authentication/authorization status from broker.

        Returns parsed auth configuration including:
        - authenticationEnabled
        - authorizationEnabled
        - authenticationProviders
        - superUserRoles
        """
        # Fetch effective runtime configuration (always a map in Pulsar 2.x and 3.x)
        auth_config_raw = {}
        try:
            runtime = await self.get_broker_runtime_config()
            if isinstance(runtime, dict):
                auth_config_raw.update(runtime)
        except Exception as e:
            logger.warning("Failed to fetch runtime broker configuration", error=str(e))

        # Merge with general configuration if needed
        # In Pulsar 3.x, get_broker_configuration() returns a list of keys, so we ignore it if it's a list
        try:
            general = await self.get_broker_configuration()
            if isinstance(general, dict):
                # Only update keys that are not already in runtime (runtime takes precedence)
                for k, v in general.items():
                    if k not in auth_config_raw:
                        auth_config_raw[k] = v
        except Exception as e:
            logger.warning("Failed to fetch general broker configuration", error=str(e))

        auth_keys = [
            "authenticationEnabled",
            "authorizationEnabled",
            "authenticationProviders",
            "authorizationProvider",
            "superUserRoles",
            "brokerClientAuthenticationPlugin",
            "anonymousUserRole",
            "tokenSecretKey",
            "tokenPublicKey",
        ]

        auth_status = {}
        for key in auth_keys:
            if key in auth_config_raw:
                value = auth_config_raw[key]
                # Robust boolean parsing
                if isinstance(value, str):
                    lower_val = value.lower().strip()
                    if lower_val in ("true", "1", "yes", "on"):
                        value = True
                    elif lower_val in ("false", "0", "no", "off"):
                        value = False
                
                # Parse lists (comma-separated or single values)
                if key in ("authenticationProviders", "superUserRoles"):
                    if isinstance(value, str):
                        value = [v.strip() for v in value.split(",") if v.strip()]
                    elif value is not None and not isinstance(value, list):
                        value = [value]
                
                auth_status[key] = value

        # Fallback: if authenticationEnabled is missing but token is provided AND we have providers,
        # it's highly likely authentication is enabled but just not reported correctly in some Pulsar versions
        if not auth_status.get("authenticationEnabled"):
            if (self.auth_token or auth_status.get("tokenSecretKey") or auth_status.get("tokenPublicKey")) and auth_status.get("authenticationProviders"):
                auth_status["authenticationEnabled"] = True

        return auth_status

    # -------------------------------------------------------------------------
    # Message operations
    # -------------------------------------------------------------------------

    async def peek_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        subscription: str,
        count: int = 10,
        persistent: bool = True,
    ) -> list[dict[str, Any]]:
        """Peek messages from a subscription without consuming them."""
        topic_type = "persistent" if persistent else "non-persistent"
        client = await self._get_client()

        messages = []
        for i in range(1, count + 1):
            try:
                # Peek one message at position i
                response = await client.get(
                    f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/subscription/{subscription}/position/{i}",
                    headers={"Accept": "application/json"},
                )

                if response.status_code == 200:
                    # Try to parse as JSON first
                    try:
                        content = response.json()
                    except Exception:
                        content = response.text

                    # Get message metadata from headers
                    msg_data = {
                        "index": i - 1,
                        "messageId": response.headers.get("X-Pulsar-Message-Id", f"msg-{i}"),
                        "publishTime": response.headers.get("X-Pulsar-publish-time", ""),
                        "producerName": response.headers.get("X-Pulsar-producer-name", ""),
                        "key": response.headers.get("X-Pulsar-partition-key", ""),
                        "eventTime": response.headers.get("X-Pulsar-event-time", ""),
                        "properties": {},
                        "payload": content,
                        "redeliveryCount": 0,
                    }

                    # Parse properties from headers
                    for key, value in response.headers.items():
                        if key.lower().startswith("x-pulsar-property-"):
                            prop_name = key[18:]  # Remove "X-Pulsar-property-"
                            msg_data["properties"][prop_name] = value

                    messages.append(msg_data)
                elif response.status_code == 204:
                    # No more messages
                    break
                else:
                    # Stop on error
                    break
            except Exception:
                break

        return messages

    async def skip_all_messages(
        self,
        topic: str,
        subscription: str,
    ) -> None:
        """Skip all messages in a subscription (clear backlog)."""
        parts = topic.replace("://", "/").split("/")
        if len(parts) != 4:
            raise ValidationError(f"Invalid topic name: {topic}")

        topic_type, tenant, namespace, topic_name = parts
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic_name}/subscription/{subscription}/skip_all",
        )
        self._handle_response(response, "subscription")

    async def get_partitioned_topic_metadata(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get partitioned topic metadata."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/partitions",
        )
        return self._handle_response(response, "topic")

    async def update_partitioned_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        partitions: int,
        persistent: bool = True,
    ) -> None:
        """Update the number of partitions for a partitioned topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "POST",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/partitions",
            json=partitions,
        )
        self._handle_response(response, "topic")

    async def unload_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Unload a topic from the broker."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/unload",
        )
        self._handle_response(response, "topic")

    async def compact_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Trigger compaction on a topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/compaction",
        )
        self._handle_response(response, "topic")

    async def offload_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> None:
        """Trigger offload on a topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "PUT",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/offload",
        )
        self._handle_response(response, "topic")

    async def get_message_by_id(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        ledger_id: int,
        entry_id: int,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get a specific message by ledger ID and entry ID."""
        topic_type = "persistent" if persistent else "non-persistent"
        client = await self._get_client()
        response = await client.get(
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/ledger/{ledger_id}/entry/{entry_id}",
            headers={"Accept": "application/json"},
        )

        if response.status_code == 200:
            try:
                content = response.json()
            except Exception:
                content = response.text

            return {
                "messageId": f"{ledger_id}:{entry_id}",
                "publishTime": response.headers.get("X-Pulsar-publish-time", ""),
                "producerName": response.headers.get("X-Pulsar-producer-name", ""),
                "key": response.headers.get("X-Pulsar-partition-key", ""),
                "eventTime": response.headers.get("X-Pulsar-event-time", ""),
                "properties": {},
                "payload": content,
            }
        elif response.status_code == 404:
            raise NotFoundError("message", f"{ledger_id}:{entry_id}")
        else:
            self._handle_response(response, "message")
            return {}

    async def get_last_message_id(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        persistent: bool = True,
    ) -> dict[str, Any]:
        """Get the last message ID for a topic."""
        topic_type = "persistent" if persistent else "non-persistent"
        response = await self._request(
            "GET",
            f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/lastMessageId",
        )
        return self._handle_response(response, "topic")

    async def examine_messages(
        self,
        tenant: str,
        namespace: str,
        topic: str,
        initial_position: str,
        count: int,
        persistent: bool = True,
    ) -> list[dict[str, Any]]:
        """Examine messages from a topic without a subscription."""
        topic_type = "persistent" if persistent else "non-persistent"
        client = await self._get_client()

        messages = []
        for i in range(count):
            try:
                response = await client.get(
                    f"/admin/v2/{topic_type}/{tenant}/{namespace}/{topic}/examinemessage",
                    params={"initialPosition": initial_position, "messagePosition": i + 1},
                    headers={"Accept": "application/json"},
                )

                if response.status_code == 200:
                    try:
                        content = response.json()
                    except Exception:
                        content = response.text

                    msg_data = {
                        "index": i,
                        "messageId": response.headers.get("X-Pulsar-Message-Id", f"msg-{i}"),
                        "publishTime": response.headers.get("X-Pulsar-publish-time", ""),
                        "producerName": response.headers.get("X-Pulsar-producer-name", ""),
                        "key": response.headers.get("X-Pulsar-partition-key", ""),
                        "eventTime": response.headers.get("X-Pulsar-event-time", ""),
                        "properties": {},
                        "payload": content,
                        "redeliveryCount": 0,
                    }
                    messages.append(msg_data)
                else:
                    break
            except Exception:
                break

        return messages


# Singleton instance
pulsar_admin = PulsarAdminService()
