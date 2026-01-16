"""Broker service for managing Pulsar brokers."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.repositories.stats import BrokerStatsRepository
from app.services.cache import CacheService
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)


class BrokerService:
    """Service for managing Pulsar brokers."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService,
        cache: CacheService,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.cache = cache
        self.stats_repo = BrokerStatsRepository(session)

    async def get_brokers(self, use_cache: bool = True) -> list[dict[str, Any]]:
        """Get all active brokers in the cluster.

        Note: When accessed through a proxy, we can only get stats from the broker
        that handles the request. The dashboard uses tenant-aggregated stats for
        accurate cluster-wide message rates.
        """
        env_id = self.pulsar.environment_id or "default"
        # Try cache first
        if use_cache:
            cached = await self.cache.get_brokers(env_id)
            if cached:
                return cached

        # Fetch broker URLs from Pulsar
        broker_urls = await self.pulsar.get_active_brokers()

        # Get stats from the connected broker's load report
        # Note: This only shows data for one broker when behind a proxy
        try:
            load_report = await self.pulsar.get_broker_stats()
            if load_report is None:
                load_report = {}
        except Exception:
            load_report = {}

        brokers = []
        for url in broker_urls:
            # Calculate CPU percentage (usage / limit * 100)
            cpu_data = load_report.get("cpu", {}) if isinstance(load_report.get("cpu"), dict) else {}
            cpu_usage = cpu_data.get("usage", 0)
            cpu_limit = cpu_data.get("limit", 100)  # Default to 100 to avoid division by zero
            cpu_percent = (cpu_usage / cpu_limit * 100) if cpu_limit > 0 else 0

            # Calculate Memory percentage (usage / limit * 100)
            mem_data = load_report.get("memory", {}) if isinstance(load_report.get("memory"), dict) else {}
            mem_usage = mem_data.get("usage", 0)
            mem_limit = mem_data.get("limit", 100)
            mem_percent = (mem_usage / mem_limit * 100) if mem_limit > 0 else 0

            # Calculate Direct Memory percentage
            direct_data = load_report.get("directMemory", {}) if isinstance(load_report.get("directMemory"), dict) else {}
            direct_usage = direct_data.get("usage", 0)
            direct_limit = direct_data.get("limit", 100)
            direct_percent = (direct_usage / direct_limit * 100) if direct_limit > 0 else 0

            broker_data = {
                "url": url,
                "topics_count": load_report.get("numTopics", 0),
                "bundles_count": load_report.get("numBundles", 0),
                "producers_count": load_report.get("numProducers", 0),
                "consumers_count": load_report.get("numConsumers", 0),
                "msg_rate_in": load_report.get("msgRateIn", 0),
                "msg_rate_out": load_report.get("msgRateOut", 0),
                "msg_throughput_in": load_report.get("msgThroughputIn", 0),
                "msg_throughput_out": load_report.get("msgThroughputOut", 0),
                "cpu_usage": round(cpu_percent, 1),
                "memory_usage": round(mem_percent, 1),
                "direct_memory_usage": round(direct_percent, 1),
            }
            brokers.append(broker_data)

        # Cache result
        await self.cache.set_brokers(env_id, brokers)

        return brokers

    async def get_broker(self, broker_url: str) -> dict[str, Any]:
        """Get detailed stats for a specific broker."""
        env_id = self.pulsar.environment_id or "default"
        # Verify broker exists
        broker_urls = await self.pulsar.get_active_brokers()
        if broker_url not in broker_urls:
            raise NotFoundError("broker", broker_url)

        # Get live stats from Pulsar
        try:
            stats = await self.pulsar.get_broker_stats(broker_url)
        except Exception:
            stats = {}

        # Get cached broker stats
        cached_stats = await self.cache.get_broker_stats(env_id, broker_url)
        if cached_stats:
            stats.update(cached_stats)

        # Get namespaces owned by this broker
        try:
            owned_namespaces = await self.pulsar.get_owned_namespaces(broker_url)
        except Exception:
            owned_namespaces = []

        return {
            "url": broker_url,
            "topics_count": stats.get("topicsCount", 0),
            "bundles_count": stats.get("bundlesCount", 0),
            "producers_count": stats.get("producersCount", 0),
            "consumers_count": stats.get("consumersCount", 0),
            "msg_rate_in": stats.get("msgRateIn", 0),
            "msg_rate_out": stats.get("msgRateOut", 0),
            "msg_throughput_in": stats.get("msgThroughputIn", 0),
            "msg_throughput_out": stats.get("msgThroughputOut", 0),
            "cpu_usage": stats.get("cpu", {}).get("usage", 0),
            "memory_usage": stats.get("memory", {}).get("usage", 0),
            "direct_memory_usage": stats.get("directMemory", {}).get("usage", 0),
            "jvm_heap_used": stats.get("jvmHeapUsed", 0),
            "jvm_heap_max": stats.get("jvmHeapMax", 0),
            "owned_namespaces": owned_namespaces,
        }

    async def get_broker_load(self, broker_url: str) -> dict[str, Any]:
        """Get load data for a specific broker."""
        try:
            load_report = await self.pulsar.get_broker_load(broker_url)
        except NotFoundError:
            raise NotFoundError("broker", broker_url)

        return {
            "url": broker_url,
            "cpu_usage": load_report.get("cpu", {}).get("usage", 0),
            "cpu_limit": load_report.get("cpu", {}).get("limit", 100),
            "memory_usage": load_report.get("memory", {}).get("usage", 0),
            "memory_limit": load_report.get("memory", {}).get("limit", 0),
            "direct_memory_usage": load_report.get("directMemory", {}).get("usage", 0),
            "direct_memory_limit": load_report.get("directMemory", {}).get("limit", 0),
            "bandwidth_in_usage": load_report.get("bandwidthIn", {}).get("usage", 0),
            "bandwidth_in_limit": load_report.get("bandwidthIn", {}).get("limit", 0),
            "bandwidth_out_usage": load_report.get("bandwidthOut", {}).get("usage", 0),
            "bandwidth_out_limit": load_report.get("bandwidthOut", {}).get("limit", 0),
            "msg_rate_in": load_report.get("msgRateIn", 0),
            "msg_rate_out": load_report.get("msgRateOut", 0),
            "msg_throughput_in": load_report.get("msgThroughputIn", 0),
            "msg_throughput_out": load_report.get("msgThroughputOut", 0),
            "topics_count": load_report.get("numTopics", 0),
            "bundles_count": load_report.get("numBundles", 0),
            "consumers_count": load_report.get("numConsumers", 0),
            "producers_count": load_report.get("numProducers", 0),
            "last_update": load_report.get("timestamp"),
        }

    async def get_cluster_info(self) -> dict[str, Any]:
        """Get overall cluster information."""
        # Get clusters
        clusters = await self.pulsar.get_clusters()

        # Get brokers
        brokers = await self.get_brokers(use_cache=False)

        # Aggregate stats
        total_topics = sum(b.get("topics_count", 0) for b in brokers)
        total_producers = sum(b.get("producers_count", 0) for b in brokers)
        total_consumers = sum(b.get("consumers_count", 0) for b in brokers)
        total_msg_rate_in = sum(b.get("msg_rate_in", 0) for b in brokers)
        total_msg_rate_out = sum(b.get("msg_rate_out", 0) for b in brokers)

        return {
            "clusters": clusters,
            "broker_count": len(brokers),
            "brokers": brokers,
            "total_topics": total_topics,
            "total_producers": total_producers,
            "total_consumers": total_consumers,
            "total_msg_rate_in": total_msg_rate_in,
            "total_msg_rate_out": total_msg_rate_out,
        }

    async def get_leader_broker(self) -> dict[str, Any]:
        """Get the leader broker for the cluster."""
        try:
            leader = await self.pulsar.get_leader_broker()
            return {
                "url": leader.get("serviceUrl"),
                "broker_id": leader.get("brokerId"),
            }
        except Exception:
            return {"url": None, "broker_id": None}

    async def health_check(self) -> dict[str, Any]:
        """Perform health check on the Pulsar cluster."""
        is_healthy = await self.pulsar.healthcheck()

        # Get broker count
        try:
            brokers = await self.pulsar.get_active_brokers()
            broker_count = len(brokers)
        except Exception:
            broker_count = 0

        return {
            "healthy": is_healthy,
            "broker_count": broker_count,
            "status": "ok" if is_healthy else "unhealthy",
        }

    async def get_runtime_config(self) -> dict[str, Any]:
        """Get broker runtime configuration."""
        try:
            config = await self.pulsar.get_broker_runtime_config()
            return config
        except Exception as e:
            logger.warning("Failed to get broker runtime config", error=str(e))
            return {}

    async def get_internal_config(self) -> dict[str, Any]:
        """Get broker internal configuration."""
        try:
            config = await self.pulsar.get_broker_internal_config()
            return {
                "zookeeper_servers": config.get("zookeeperServers"),
                "configuration_store_servers": config.get("configurationStoreServers"),
                "cluster_name": config.get("clusterName"),
                "broker_version": config.get("brokerVersion"),
            }
        except Exception as e:
            logger.warning("Failed to get broker internal config", error=str(e))
            return {}
