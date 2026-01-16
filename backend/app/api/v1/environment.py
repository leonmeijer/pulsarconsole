"""Environment API routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.deps import CurrentApprovedUser, CurrentSuperuser, DbSession, EnvService
from app.models.environment import AuthMode, Environment
from app.models.oidc_provider import OIDCProvider
from app.schemas import (
    EnvironmentCreate,
    EnvironmentListResponse,
    EnvironmentResponse,
    EnvironmentTestRequest,
    EnvironmentTestResponse,
    EnvironmentUpdate,
    OIDCProviderCreate,
    OIDCProviderResponse,
    OIDCProviderUpdate,
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
        oidc_mode=env.oidc_mode.value,
        has_token=env.token_encrypted is not None,
        ca_bundle_ref=env.ca_bundle_ref,
        is_active=env.is_active,
        is_shared=env.is_shared,
        created_by_id=env.created_by_id,
        created_at=env.created_at,
        updated_at=env.updated_at,
    )


@router.get("", response_model=EnvironmentResponse | None)
async def get_environment(_user: CurrentApprovedUser, service: EnvService) -> EnvironmentResponse | None:
    """Get the active environment configuration."""
    env = await service.get_environment()
    if env is None:
        return None
    return _env_to_response(env)


@router.get("/all", response_model=EnvironmentListResponse)
async def list_environments(user: CurrentApprovedUser, service: EnvService) -> EnvironmentListResponse:
    """List all environment configurations."""
    envs = await service.get_all_environments(user_id=user.id)
    return EnvironmentListResponse(
        environments=[_env_to_response(env) for env in envs],
        total=len(envs),
    )


@router.post("/{name}/activate", response_model=EnvironmentResponse)
async def activate_environment(name: str, _user: CurrentApprovedUser, service: EnvService) -> EnvironmentResponse:
    """Set an environment as active."""
    env = await service.set_active_environment(name)
    return _env_to_response(env)


@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(
    data: EnvironmentCreate,
    user: CurrentApprovedUser,
    service: EnvService,
) -> EnvironmentResponse:
    """Create a new environment configuration."""
    from app.models.environment import OIDCMode
    env = await service.create_environment(
        name=data.name,
        admin_url=data.admin_url,
        auth_mode=AuthMode(data.auth_mode),
        oidc_mode=OIDCMode(data.oidc_mode),
        token=data.token,
        ca_bundle_ref=data.ca_bundle_ref,
        validate_connectivity=data.validate_connectivity,
        is_shared=data.is_shared,
        created_by_id=user.id,
    )
    return _env_to_response(env)


@router.put("/{name}", response_model=EnvironmentResponse)
async def update_environment(
    name: str,
    data: EnvironmentUpdate,
    _user: CurrentApprovedUser,
    service: EnvService,
) -> EnvironmentResponse:
    """Update environment configuration."""
    from app.models.environment import OIDCMode
    auth_mode = AuthMode(data.auth_mode) if data.auth_mode else None
    oidc_mode = OIDCMode(data.oidc_mode) if data.oidc_mode else None
    env = await service.update_environment(
        name=name,
        admin_url=data.admin_url,
        auth_mode=auth_mode,
        oidc_mode=oidc_mode,
        token=data.token,
        ca_bundle_ref=data.ca_bundle_ref,
        validate_connectivity=data.validate_connectivity,
        is_shared=data.is_shared,
    )
    return _env_to_response(env)


@router.delete("/{name}", response_model=SuccessResponse)
async def delete_environment(name: str, _user: CurrentApprovedUser, service: EnvService) -> SuccessResponse:
    """Delete environment configuration."""
    deleted = await service.delete_environment(name)
    return SuccessResponse(
        success=deleted,
        message="Environment deleted" if deleted else "Environment not found",
    )


@router.post("/test", response_model=EnvironmentTestResponse)
async def test_connectivity(
    req: Request,
    data: EnvironmentTestRequest,
    _user: CurrentApprovedUser,
    service: EnvService,
) -> EnvironmentTestResponse:
    """Test connectivity to a Pulsar cluster."""
    import time
    from app.api.deps import _extract_token

    # Use provided token, or fall back to current user's token
    token = data.token or _extract_token(req)

    start = time.time()
    success, message = await service.test_connectivity(data.admin_url, token)
    latency = (time.time() - start) * 1000

    return EnvironmentTestResponse(
        success=success,
        message=message,
        latency_ms=latency if success else None,
    )


# =============================================================================
# OIDC Provider Configuration Endpoints
# =============================================================================


def _oidc_provider_to_response(provider: OIDCProvider) -> OIDCProviderResponse:
    """Convert OIDCProvider model to response schema."""
    return OIDCProviderResponse(
        id=provider.id,
        environment_id=provider.environment_id,
        issuer_url=provider.issuer_url,
        client_id=provider.client_id,
        has_client_secret=provider.client_secret_encrypted is not None,
        use_pkce=provider.use_pkce,
        scopes=provider.scopes,
        role_claim=provider.role_claim,
        auto_create_users=provider.auto_create_users,
        default_role_name=provider.default_role_name,
        group_role_mappings=provider.group_role_mappings,
        admin_groups=provider.admin_groups,
        sync_roles_on_login=provider.sync_roles_on_login,
        is_enabled=provider.is_enabled,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
        is_global=False,  # Database providers are not global
    )


@router.get("/{env_id}/oidc-provider", response_model=OIDCProviderResponse | None)
async def get_oidc_provider(
    env_id: UUID,
    _user: CurrentApprovedUser,
    db: DbSession,
) -> OIDCProviderResponse | None:
    """Get OIDC provider configuration for an environment.

    If using global OIDC (env vars) and no database provider exists,
    returns a virtual provider with global config values.
    """
    from app.repositories.oidc_provider import OIDCProviderRepository
    from app.config import settings

    repo = OIDCProviderRepository(db)
    provider = await repo.get_for_environment(env_id)

    if provider:
        return _oidc_provider_to_response(provider)

    # If no database provider but global OIDC is enabled, return virtual config
    if settings.oidc_enabled and settings.oidc_issuer_url:
        return OIDCProviderResponse(
            id=str(env_id),  # Use env_id as virtual ID
            environment_id=env_id,
            issuer_url=settings.oidc_issuer_url,
            client_id=settings.oidc_client_id or "",
            has_client_secret=settings.oidc_client_secret is not None,
            use_pkce=settings.oidc_use_pkce,
            scopes=["openid", "email", "profile"],
            role_claim=settings.oidc_role_claim,
            auto_create_users=True,
            default_role_name=None,
            group_role_mappings=None,
            admin_groups=settings.oidc_admin_groups_list if settings.oidc_admin_groups_list else None,
            sync_roles_on_login=settings.oidc_sync_roles_on_login,
            is_enabled=True,
            created_at=None,
            updated_at=None,
            is_global=True,  # Flag to indicate this is from global config
        )

    return None


@router.post(
    "/{env_id}/oidc-provider",
    response_model=OIDCProviderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_oidc_provider(
    env_id: UUID,
    data: OIDCProviderCreate,
    _user: CurrentSuperuser,
    db: DbSession,
) -> OIDCProviderResponse:
    """Create OIDC provider configuration for an environment."""
    from app.repositories.oidc_provider import OIDCProviderRepository
    from app.core.security import encrypt_value

    repo = OIDCProviderRepository(db)

    # Check if provider already exists
    existing = await repo.get_for_environment(env_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="OIDC provider already exists for this environment",
        )

    # Encrypt client secret if provided
    client_secret_encrypted = None
    if data.client_secret:
        client_secret_encrypted = encrypt_value(data.client_secret)

    provider = await repo.create(
        environment_id=env_id,
        issuer_url=data.issuer_url,
        client_id=data.client_id,
        client_secret_encrypted=client_secret_encrypted,
        use_pkce=data.use_pkce,
        scopes=data.scopes,
        role_claim=data.role_claim,
        auto_create_users=data.auto_create_users,
        default_role_name=data.default_role_name,
        group_role_mappings=data.group_role_mappings,
        admin_groups=data.admin_groups,
        sync_roles_on_login=data.sync_roles_on_login,
    )
    await db.commit()
    return _oidc_provider_to_response(provider)


@router.put("/{env_id}/oidc-provider", response_model=OIDCProviderResponse)
async def update_oidc_provider(
    env_id: UUID,
    data: OIDCProviderUpdate,
    _user: CurrentSuperuser,
    db: DbSession,
) -> OIDCProviderResponse:
    """Update OIDC provider configuration for an environment.

    If using global OIDC and no database provider exists, this will create
    a new database record that overrides the global config for group mappings.
    """
    from app.repositories.oidc_provider import OIDCProviderRepository
    from app.core.security import encrypt_value
    from app.config import settings

    repo = OIDCProviderRepository(db)
    provider = await repo.get_for_environment(env_id)

    # If no database provider exists but global OIDC is enabled,
    # create a new provider record with global settings + updates
    if not provider and settings.oidc_enabled and settings.oidc_issuer_url:
        # Encrypt client secret if we have one from global config
        client_secret_encrypted = None
        if settings.oidc_client_secret:
            client_secret_encrypted = encrypt_value(settings.oidc_client_secret)
        if data.client_secret:
            client_secret_encrypted = encrypt_value(data.client_secret)

        provider = await repo.create(
            environment_id=env_id,
            issuer_url=data.issuer_url or settings.oidc_issuer_url,
            client_id=data.client_id or settings.oidc_client_id or "",
            client_secret_encrypted=client_secret_encrypted,
            use_pkce=data.use_pkce if data.use_pkce is not None else settings.oidc_use_pkce,
            scopes=data.scopes or ["openid", "email", "profile"],
            role_claim=data.role_claim or settings.oidc_role_claim,
            auto_create_users=data.auto_create_users if data.auto_create_users is not None else True,
            default_role_name=data.default_role_name,
            group_role_mappings=data.group_role_mappings,
            admin_groups=data.admin_groups or (settings.oidc_admin_groups_list if settings.oidc_admin_groups_list else None),
            sync_roles_on_login=data.sync_roles_on_login if data.sync_roles_on_login is not None else settings.oidc_sync_roles_on_login,
        )
        await db.commit()
        return _oidc_provider_to_response(provider)

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OIDC provider not found for this environment",
        )

    # Build update dict with only provided fields
    update_data = {}
    if data.issuer_url is not None:
        update_data["issuer_url"] = data.issuer_url
    if data.client_id is not None:
        update_data["client_id"] = data.client_id
    if data.client_secret is not None:
        update_data["client_secret_encrypted"] = encrypt_value(data.client_secret)
    if data.use_pkce is not None:
        update_data["use_pkce"] = data.use_pkce
    if data.scopes is not None:
        update_data["scopes"] = data.scopes
    if data.role_claim is not None:
        update_data["role_claim"] = data.role_claim
    if data.auto_create_users is not None:
        update_data["auto_create_users"] = data.auto_create_users
    if data.default_role_name is not None:
        update_data["default_role_name"] = data.default_role_name
    if data.group_role_mappings is not None:
        update_data["group_role_mappings"] = data.group_role_mappings
    if data.admin_groups is not None:
        update_data["admin_groups"] = data.admin_groups
    if data.sync_roles_on_login is not None:
        update_data["sync_roles_on_login"] = data.sync_roles_on_login
    if data.is_enabled is not None:
        update_data["is_enabled"] = data.is_enabled

    if update_data:
        provider = await repo.update(provider.id, **update_data)
        await db.commit()

    return _oidc_provider_to_response(provider)


@router.delete("/{env_id}/oidc-provider", response_model=SuccessResponse)
async def delete_oidc_provider(
    env_id: UUID,
    _user: CurrentSuperuser,
    db: DbSession,
) -> SuccessResponse:
    """Delete OIDC provider configuration for an environment."""
    from app.repositories.oidc_provider import OIDCProviderRepository

    repo = OIDCProviderRepository(db)
    provider = await repo.get_for_environment(env_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OIDC provider not found for this environment",
        )

    await repo.delete(provider.id)
    await db.commit()

    return SuccessResponse(success=True, message="OIDC provider deleted")
