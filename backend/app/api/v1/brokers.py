"""Broker API routes."""

from fastapi import APIRouter, Query

from app.api.deps import BrokerSvc
from app.schemas import (
    BrokerConfigResponse,
    BrokerDetailResponse,
    BrokerListResponse,
    BrokerLoadResponse,
    BrokerResponse,
    ClusterInfoResponse,
    HealthResponse,
    LeaderBrokerResponse,
)

router = APIRouter(prefix="/brokers", tags=["Brokers"])


@router.get("", response_model=BrokerListResponse)
async def list_brokers(
    service: BrokerSvc,
    use_cache: bool = Query(default=True, description="Use cached data"),
) -> BrokerListResponse:
    """List all active brokers."""
    brokers = await service.get_brokers(use_cache=use_cache)
    return BrokerListResponse(
        brokers=[BrokerResponse(**b) for b in brokers],
        total=len(brokers),
    )


@router.get("/cluster", response_model=ClusterInfoResponse)
async def get_cluster_info(service: BrokerSvc) -> ClusterInfoResponse:
    """Get overall cluster information."""
    data = await service.get_cluster_info()
    return ClusterInfoResponse(**data)


@router.get("/leader", response_model=LeaderBrokerResponse)
async def get_leader_broker(service: BrokerSvc) -> LeaderBrokerResponse:
    """Get the leader broker for the cluster."""
    data = await service.get_leader_broker()
    return LeaderBrokerResponse(**data)


@router.get("/health", response_model=HealthResponse)
async def health_check(service: BrokerSvc) -> HealthResponse:
    """Perform health check on the Pulsar cluster."""
    data = await service.health_check()
    return HealthResponse(
        status=data["status"],
        healthy=data["healthy"],
        details={"broker_count": data["broker_count"]},
    )


@router.get("/config/runtime", response_model=BrokerConfigResponse)
async def get_runtime_config(service: BrokerSvc) -> BrokerConfigResponse:
    """Get broker runtime configuration."""
    config = await service.get_runtime_config()
    return BrokerConfigResponse(config=config)


@router.get("/config/internal", response_model=dict)
async def get_internal_config(service: BrokerSvc) -> dict:
    """Get broker internal configuration."""
    return await service.get_internal_config()


@router.get("/{broker_url:path}/details", response_model=BrokerDetailResponse)
async def get_broker(broker_url: str, service: BrokerSvc) -> BrokerDetailResponse:
    """Get detailed stats for a specific broker."""
    data = await service.get_broker(broker_url)
    return BrokerDetailResponse(**data)


@router.get("/{broker_url:path}/load", response_model=BrokerLoadResponse)
async def get_broker_load(broker_url: str, service: BrokerSvc) -> BrokerLoadResponse:
    """Get load data for a specific broker."""
    data = await service.get_broker_load(broker_url)
    return BrokerLoadResponse(**data)
