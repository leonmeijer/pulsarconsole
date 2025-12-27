"""Environment API routes."""

from fastapi import APIRouter, status

from app.api.deps import DbSession, EnvService
from app.models.environment import AuthMode, Environment
from app.schemas import (
    EnvironmentCreate,
    EnvironmentListResponse,
    EnvironmentResponse,
    EnvironmentTestRequest,
    EnvironmentTestResponse,
    EnvironmentUpdate,
    SuccessResponse,
)

router = APIRouter(prefix="/environment", tags=["Environment"])


def _env_to_response(env: Environment) -> EnvironmentResponse:
    """Convert Environment model to response schema."""
    return EnvironmentResponse(
        id=env.id,
        name=env.name,
        admin_url=env.admin_url,
        auth_mode=env.auth_mode.value,
        has_token=env.token_encrypted is not None,
        ca_bundle_ref=env.ca_bundle_ref,
        is_active=env.is_active,
        created_at=env.created_at,
        updated_at=env.updated_at,
    )


@router.get("", response_model=EnvironmentResponse | None)
async def get_environment(service: EnvService) -> EnvironmentResponse | None:
    """Get the active environment configuration."""
    env = await service.get_environment()
    if env is None:
        return None
    return _env_to_response(env)


@router.get("/all", response_model=EnvironmentListResponse)
async def list_environments(service: EnvService) -> EnvironmentListResponse:
    """List all environment configurations."""
    envs = await service.get_all_environments()
    return EnvironmentListResponse(
        environments=[_env_to_response(env) for env in envs],
        total=len(envs),
    )


@router.post("/{name}/activate", response_model=EnvironmentResponse)
async def activate_environment(name: str, service: EnvService) -> EnvironmentResponse:
    """Set an environment as active."""
    env = await service.set_active_environment(name)
    return _env_to_response(env)


@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(
    data: EnvironmentCreate,
    service: EnvService,
) -> EnvironmentResponse:
    """Create a new environment configuration."""
    env = await service.create_environment(
        name=data.name,
        admin_url=data.admin_url,
        auth_mode=AuthMode(data.auth_mode),
        token=data.token,
        ca_bundle_ref=data.ca_bundle_ref,
        validate_connectivity=data.validate_connectivity,
    )
    return _env_to_response(env)


@router.put("/{name}", response_model=EnvironmentResponse)
async def update_environment(
    name: str,
    data: EnvironmentUpdate,
    service: EnvService,
) -> EnvironmentResponse:
    """Update environment configuration."""
    auth_mode = AuthMode(data.auth_mode) if data.auth_mode else None
    env = await service.update_environment(
        name=name,
        admin_url=data.admin_url,
        auth_mode=auth_mode,
        token=data.token,
        ca_bundle_ref=data.ca_bundle_ref,
        validate_connectivity=data.validate_connectivity,
    )
    return _env_to_response(env)


@router.delete("/{name}", response_model=SuccessResponse)
async def delete_environment(name: str, service: EnvService) -> SuccessResponse:
    """Delete environment configuration."""
    deleted = await service.delete_environment(name)
    return SuccessResponse(
        success=deleted,
        message="Environment deleted" if deleted else "Environment not found",
    )


@router.post("/test", response_model=EnvironmentTestResponse)
async def test_connectivity(
    data: EnvironmentTestRequest,
    service: EnvService,
) -> EnvironmentTestResponse:
    """Test connectivity to a Pulsar cluster."""
    import time

    start = time.time()
    is_connected = await service.test_connectivity(data.admin_url, data.token)
    latency = (time.time() - start) * 1000

    return EnvironmentTestResponse(
        success=is_connected,
        message="Connection successful" if is_connected else "Connection failed",
        latency_ms=latency if is_connected else None,
    )
