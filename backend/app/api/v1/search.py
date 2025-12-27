"""Global search API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import PulsarClient
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    """A single search result."""

    type: str  # tenant, namespace, topic, subscription, consumer, broker
    name: str
    path: str
    description: str | None = None
    tenant: str | None = None
    namespace: str | None = None
    topic: str | None = None
    subscription: str | None = None


class SearchResponse(BaseModel):
    """Search response."""

    results: list[SearchResult]
    query: str
    total: int


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str,
    pulsar: PulsarClient,
    limit: int = 20,
) -> SearchResponse:
    """
    Search across all Pulsar resources.

    Searches tenants, namespaces, topics, subscriptions, and brokers.
    """
    results: list[SearchResult] = []
    query_lower = q.lower().strip()

    if not query_lower:
        return SearchResponse(results=[], query=q, total=0)

    try:
        # Search tenants
        tenants = await pulsar.get_tenants()
        for tenant_name in tenants:
            if query_lower in tenant_name.lower():
                results.append(
                    SearchResult(
                        type="tenant",
                        name=tenant_name,
                        path=f"/tenants/{tenant_name}",
                        description="Tenant",
                        tenant=tenant_name,
                    )
                )

        # Search namespaces and topics
        for tenant_name in tenants[:10]:  # Limit to first 10 tenants for performance
            try:
                namespaces = await pulsar.get_namespaces(tenant_name)
                for ns in namespaces:
                    # ns is like "public/default"
                    ns_name = ns.split("/")[-1] if "/" in ns else ns
                    full_ns = f"{tenant_name}/{ns_name}"

                    # Search namespace name
                    if query_lower in ns_name.lower() or query_lower in full_ns.lower():
                        results.append(
                            SearchResult(
                                type="namespace",
                                name=full_ns,
                                path=f"/tenants/{tenant_name}/namespaces/{ns_name}",
                                description="Namespace",
                                tenant=tenant_name,
                                namespace=ns_name,
                            )
                        )

                    # Search topics in this namespace
                    try:
                        # get_topics returns list of topic names like "persistent://public/default/test-queue"
                        topics = await pulsar.get_topics(tenant_name, ns_name)
                        for topic_full in topics:
                            # Extract short name from persistent://tenant/ns/topic
                            topic_short = topic_full.split("/")[-1] if "/" in topic_full else topic_full

                            if query_lower in topic_short.lower() or query_lower in topic_full.lower():
                                results.append(
                                    SearchResult(
                                        type="topic",
                                        name=topic_short,
                                        path=f"/tenants/{tenant_name}/namespaces/{ns_name}/topics/{topic_short}",
                                        description=f"{tenant_name}/{ns_name}",
                                        tenant=tenant_name,
                                        namespace=ns_name,
                                        topic=topic_short,
                                    )
                                )

                            # Search subscriptions and consumers
                            try:
                                # get_topic_stats returns stats including subscriptions with consumers
                                stats = await pulsar.get_topic_stats(topic_full)
                                subscriptions = stats.get("subscriptions", {})

                                for sub_name, sub_stats in subscriptions.items():
                                    # Search subscription name
                                    if query_lower in sub_name.lower():
                                        results.append(
                                            SearchResult(
                                                type="subscription",
                                                name=sub_name,
                                                path=f"/tenants/{tenant_name}/namespaces/{ns_name}/topics/{topic_short}/subscription/{sub_name}",
                                                description=f"on {topic_short} · {sub_stats.get('consumers', []).__len__()} consumers",
                                                tenant=tenant_name,
                                                namespace=ns_name,
                                                topic=topic_short,
                                            )
                                        )

                                    # Search consumers within this subscription
                                    consumers = sub_stats.get("consumers", [])
                                    for consumer in consumers:
                                        consumer_name = consumer.get("consumerName", "")
                                        consumer_address = consumer.get("address", "")

                                        if query_lower in consumer_name.lower() or query_lower in consumer_address.lower():
                                            results.append(
                                                SearchResult(
                                                    type="consumer",
                                                    name=consumer_name,
                                                    path=f"/tenants/{tenant_name}/namespaces/{ns_name}/topics/{topic_short}/subscription/{sub_name}",
                                                    description=f"{sub_name} · {consumer_address}",
                                                    tenant=tenant_name,
                                                    namespace=ns_name,
                                                    topic=topic_short,
                                                    subscription=sub_name,
                                                )
                                            )
                            except Exception:
                                pass  # Skip if can't fetch stats

                    except Exception:
                        pass  # Skip if can't fetch topics

            except Exception:
                pass  # Skip if can't fetch namespaces

        # Search brokers
        try:
            clusters = await pulsar.get_clusters()
            for cluster in clusters[:3]:  # Limit to first 3 clusters
                try:
                    cluster_info = await pulsar.get_cluster(cluster)
                    broker_url = cluster_info.get("brokerServiceUrl", "")
                    if query_lower in broker_url.lower() or query_lower in cluster.lower():
                        results.append(
                            SearchResult(
                                type="broker",
                                name=cluster,
                                path="/brokers",
                                description=broker_url,
                            )
                        )
                except Exception:
                    pass
        except Exception:
            pass

        # Sort results: exact matches first, then by type priority
        type_priority = {
            "consumer": 1,
            "topic": 2,
            "subscription": 3,
            "namespace": 4,
            "tenant": 5,
            "broker": 6,
        }

        def sort_key(r: SearchResult) -> tuple:
            is_exact = r.name.lower() == query_lower
            return (0 if is_exact else 1, type_priority.get(r.type, 99))

        results.sort(key=sort_key)

        # Deduplicate by path
        seen_paths: set[str] = set()
        unique_results: list[SearchResult] = []
        for r in results:
            if r.path not in seen_paths:
                seen_paths.add(r.path)
                unique_results.append(r)

        return SearchResponse(
            results=unique_results[:limit],
            query=q,
            total=len(unique_results),
        )

    except Exception as e:
        logger.error("Search failed", error=str(e))
        return SearchResponse(results=[], query=q, total=0)
