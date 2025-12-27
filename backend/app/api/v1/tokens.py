"""Token management API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db,
    get_current_active_user,
    get_current_superuser,
    CurrentActiveUser,
    CurrentSuperuser,
)
from app.models.user import User
from app.services.api_token import ApiTokenService

router = APIRouter(prefix="/tokens", tags=["tokens"])


# =============================================================================
# Request/Response Models
# =============================================================================


class CreateTokenRequest(BaseModel):
    """Create API token request."""

    name: str
    expires_in_days: int | None = None
    scopes: list[str] | None = None


class TokenCreatedResponse(BaseModel):
    """Response when a new token is created."""

    id: str
    name: str
    token: str  # Only returned once!
    token_prefix: str
    expires_at: str | None
    scopes: list[str] | None
    message: str = "Save this token now. It will not be shown again."


class TokenInfo(BaseModel):
    """Token information (without actual token value)."""

    id: str
    name: str
    token_prefix: str
    expires_at: str | None
    last_used_at: str | None
    is_revoked: bool
    is_expired: bool
    is_valid: bool
    scopes: list[str] | None
    created_at: str


class TokensResponse(BaseModel):
    """List of tokens."""

    tokens: list[TokenInfo]


class TokenStatsResponse(BaseModel):
    """Token statistics."""

    total: int
    active: int
    revoked: int
    expired: int


class GeneratePulsarTokenRequest(BaseModel):
    """Generate Pulsar JWT token request."""

    subject: str
    expires_in_days: int | None = None


class PulsarTokenResponse(BaseModel):
    """Pulsar JWT token response."""

    token: str
    subject: str
    expires_in_days: int | None
    message: str = "Save this token now. It will not be shown again."


class SetPulsarSecretRequest(BaseModel):
    """Set Pulsar token secret key request."""

    secret_key: str


class PulsarTokenCapabilityResponse(BaseModel):
    """Pulsar token generation capability."""

    can_generate: bool
    environment_id: str | None
    environment_name: str | None


# =============================================================================
# Helper Functions
# =============================================================================


async def get_token_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiTokenService:
    """Get API token service."""
    return ApiTokenService(db)


async def get_active_environment(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> tuple[UUID, str] | None:
    """Get the active environment ID and name."""
    from app.repositories.environment import EnvironmentRepository

    env_repo = EnvironmentRepository(db)
    env = await env_repo.get_active()

    if env:
        return env.id, env.name
    return None


TokenServiceDep = Annotated[ApiTokenService, Depends(get_token_service)]


# =============================================================================
# Console API Token Endpoints
# =============================================================================


@router.post("", response_model=TokenCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_token(
    request: CreateTokenRequest,
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> TokenCreatedResponse:
    """
    Create a new API token for the current user.

    The token value is only returned once in this response.
    Store it securely as it cannot be retrieved later.
    """
    try:
        full_token, api_token = await token_service.create_token(
            user_id=current_user.id,
            name=request.name,
            expires_in_days=request.expires_in_days,
            scopes=request.scopes,
        )

        return TokenCreatedResponse(
            id=str(api_token.id),
            name=api_token.name,
            token=full_token,
            token_prefix=api_token.token_prefix,
            expires_at=api_token.expires_at.isoformat() if api_token.expires_at else None,
            scopes=api_token.scopes,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=TokensResponse)
async def list_tokens(
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
    include_revoked: bool = False,
) -> TokensResponse:
    """List all API tokens for the current user."""
    tokens = await token_service.get_user_tokens(
        current_user.id, include_revoked=include_revoked
    )

    return TokensResponse(
        tokens=[
            TokenInfo(
                id=str(t.id),
                name=t.name,
                token_prefix=t.token_prefix,
                expires_at=t.expires_at.isoformat() if t.expires_at else None,
                last_used_at=t.last_used_at.isoformat() if t.last_used_at else None,
                is_revoked=t.is_revoked,
                is_expired=t.is_expired,
                is_valid=t.is_valid,
                scopes=t.scopes,
                created_at=t.created_at.isoformat(),
            )
            for t in tokens
        ]
    )


@router.get("/stats", response_model=TokenStatsResponse)
async def get_token_stats(
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> TokenStatsResponse:
    """Get token statistics for the current user."""
    stats = await token_service.get_token_stats(current_user.id)
    return TokenStatsResponse(**stats)


@router.get("/{token_id}", response_model=TokenInfo)
async def get_token(
    token_id: UUID,
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> TokenInfo:
    """Get details of a specific token."""
    token = await token_service.get_token(token_id)

    if not token or token.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )

    return TokenInfo(
        id=str(token.id),
        name=token.name,
        token_prefix=token.token_prefix,
        expires_at=token.expires_at.isoformat() if token.expires_at else None,
        last_used_at=token.last_used_at.isoformat() if token.last_used_at else None,
        is_revoked=token.is_revoked,
        is_expired=token.is_expired,
        is_valid=token.is_valid,
        scopes=token.scopes,
        created_at=token.created_at.isoformat(),
    )


@router.post("/{token_id}/revoke")
async def revoke_token(
    token_id: UUID,
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> dict:
    """Revoke a specific token."""
    result = await token_service.revoke_token(token_id, current_user.id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )

    return {"message": "Token revoked"}


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_token(
    token_id: UUID,
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> None:
    """Delete a token permanently."""
    result = await token_service.delete_token(token_id, current_user.id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )


@router.post("/revoke-all")
async def revoke_all_tokens(
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
) -> dict:
    """Revoke all API tokens for the current user."""
    count = await token_service.revoke_all_user_tokens(current_user.id)
    return {"message": f"Revoked {count} token(s)"}


# =============================================================================
# Pulsar JWT Token Endpoints
# =============================================================================


@router.get("/pulsar/capability", response_model=PulsarTokenCapabilityResponse)
async def get_pulsar_token_capability(
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PulsarTokenCapabilityResponse:
    """Check if Pulsar token generation is available for the active environment."""
    env_info = await get_active_environment(db)

    if not env_info:
        return PulsarTokenCapabilityResponse(
            can_generate=False,
            environment_id=None,
            environment_name=None,
        )

    env_id, env_name = env_info
    can_generate = await token_service.can_generate_pulsar_tokens(env_id)

    return PulsarTokenCapabilityResponse(
        can_generate=can_generate,
        environment_id=str(env_id),
        environment_name=env_name,
    )


@router.post("/pulsar/generate", response_model=PulsarTokenResponse)
async def generate_pulsar_token(
    request: GeneratePulsarTokenRequest,
    current_user: CurrentActiveUser,
    token_service: TokenServiceDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PulsarTokenResponse:
    """
    Generate a Pulsar JWT token for the active environment.

    The token is generated using the environment's secret key and
    is only returned once in this response.
    """
    env_info = await get_active_environment(db)

    if not env_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active environment configured",
        )

    env_id, _ = env_info

    try:
        token = await token_service.generate_pulsar_token(
            environment_id=env_id,
            subject=request.subject,
            expires_in_days=request.expires_in_days,
        )

        return PulsarTokenResponse(
            token=token,
            subject=request.subject,
            expires_in_days=request.expires_in_days,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/pulsar/secret", status_code=status.HTTP_204_NO_CONTENT)
async def set_pulsar_token_secret(
    request: SetPulsarSecretRequest,
    current_user: CurrentSuperuser,
    token_service: TokenServiceDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Set the Pulsar token secret key for the active environment.

    Requires superuser privileges. The secret key is encrypted before storage.
    """
    env_info = await get_active_environment(db)

    if not env_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active environment configured",
        )

    env_id, _ = env_info

    result = await token_service.set_pulsar_token_secret(
        environment_id=env_id,
        secret_key=request.secret_key,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set secret key",
        )


@router.delete("/pulsar/secret", status_code=status.HTTP_204_NO_CONTENT)
async def remove_pulsar_token_secret(
    current_user: CurrentSuperuser,
    token_service: TokenServiceDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Remove the Pulsar token secret key from the active environment.

    Requires superuser privileges.
    """
    env_info = await get_active_environment(db)

    if not env_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active environment configured",
        )

    env_id, _ = env_info

    result = await token_service.remove_pulsar_token_secret(env_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove secret key",
        )


# =============================================================================
# Admin Endpoints (Superuser)
# =============================================================================


@router.get("/admin/user/{user_id}", response_model=TokensResponse)
async def list_user_tokens_admin(
    user_id: UUID,
    current_user: CurrentSuperuser,
    token_service: TokenServiceDep,
    include_revoked: bool = True,
) -> TokensResponse:
    """List all API tokens for a specific user. Requires superuser privileges."""
    tokens = await token_service.get_user_tokens(
        user_id, include_revoked=include_revoked
    )

    return TokensResponse(
        tokens=[
            TokenInfo(
                id=str(t.id),
                name=t.name,
                token_prefix=t.token_prefix,
                expires_at=t.expires_at.isoformat() if t.expires_at else None,
                last_used_at=t.last_used_at.isoformat() if t.last_used_at else None,
                is_revoked=t.is_revoked,
                is_expired=t.is_expired,
                is_valid=t.is_valid,
                scopes=t.scopes,
                created_at=t.created_at.isoformat(),
            )
            for t in tokens
        ]
    )


@router.post("/admin/user/{user_id}/revoke-all")
async def revoke_all_user_tokens_admin(
    user_id: UUID,
    current_user: CurrentSuperuser,
    token_service: TokenServiceDep,
) -> dict:
    """Revoke all API tokens for a specific user. Requires superuser privileges."""
    count = await token_service.revoke_all_user_tokens(user_id)
    return {"message": f"Revoked {count} token(s)"}
