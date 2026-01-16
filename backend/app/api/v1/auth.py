"""Authentication API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.security import generate_token, hash_value, TokenPair
from app.services.auth import AuthService, OIDCConfig

router = APIRouter(prefix="/auth", tags=["authentication"])


# =============================================================================
# Request/Response Models
# =============================================================================


class OIDCProviderInfo(BaseModel):
    """OIDC provider information for login."""

    id: str
    name: str
    issuer_url: str
    login_url: str | None = None


class ProvidersResponse(BaseModel):
    """Available authentication providers."""

    providers: list[OIDCProviderInfo]
    auth_required: bool


class LoginRequest(BaseModel):
    """Login initiation request."""

    environment_id: str  # UUID or "global" for global OIDC config
    redirect_uri: str


class LoginResponse(BaseModel):
    """Login initiation response."""

    authorization_url: str
    state: str


class CallbackRequest(BaseModel):
    """OIDC callback request."""

    code: str
    state: str


class TokenResponse(BaseModel):
    """Token response."""

    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


class RefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class UserRoleInfo(BaseModel):
    """Role information for user."""

    id: str
    name: str


class UserResponse(BaseModel):
    """Current user information."""

    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    is_active: bool
    is_global_admin: bool = False
    roles: list[UserRoleInfo] = []

    class Config:
        from_attributes = True


class SessionInfo(BaseModel):
    """Session information."""

    id: str
    ip_address: str | None
    user_agent: str | None
    created_at: str
    expires_at: str
    is_current: bool


class SessionsResponse(BaseModel):
    """List of user sessions."""

    sessions: list[SessionInfo]


class ThemePreferenceRequest(BaseModel):
    """Theme preference update request."""

    theme: str | None = None  # e.g., 'current-dark', 'slate-light'
    mode: str | None = None   # 'light', 'dark', or 'system'


class ThemePreferenceResponse(BaseModel):
    """Theme preference response."""

    theme: str | None
    mode: str | None


# =============================================================================
# State Management (in production, use Redis)
# =============================================================================

# In-memory state storage (replace with Redis in production)
_oauth_states: dict[str, dict] = {}


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/providers", response_model=ProvidersResponse)
async def get_providers(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProvidersResponse:
    """Get available authentication providers."""
    from app.repositories.oidc_provider import OIDCProviderRepository
    from app.repositories.environment import EnvironmentRepository
    from app.core.logging import get_logger
    logger = get_logger(__name__)

    oidc_repo = OIDCProviderRepository(db)
    env_repo = EnvironmentRepository(db)

    provider_infos = []

    # Check global OIDC config from environment variables first
    logger.debug("Checking global OIDC config", 
                 enabled=settings.oidc_enabled, 
                 issuer=settings.oidc_issuer_url, 
                 client_id=settings.oidc_client_id)
    
    if settings.oidc_enabled and settings.oidc_issuer_url and settings.oidc_client_id:
        provider_infos.append(
            OIDCProviderInfo(
                id="global",
                name="Pulsar Console",
                issuer_url=settings.oidc_issuer_url,
            )
        )

    # Get all enabled OIDC providers from database
    providers = await oidc_repo.get_enabled_providers()

    for provider in providers:
        # Get environment for display name
        env = await env_repo.get_by_id(provider.environment_id)
        env_name = env.name if env else "Unknown"

        provider_infos.append(
            OIDCProviderInfo(
                id=str(provider.environment_id),
                name=env_name,
                issuer_url=provider.issuer_url,
            )
        )

    # Auth is required if any provider is configured (global or per-environment)
    auth_required = len(provider_infos) > 0
    
    logger.debug("Final providers list", count=len(provider_infos), auth_required=auth_required)

    return ProvidersResponse(
        providers=provider_infos,
        auth_required=auth_required,
    )


@router.post("/login", response_model=LoginResponse)
async def initiate_login(
    request: Request,
    login_request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    """Initiate OIDC login flow with PKCE support."""
    auth_service = AuthService(db)

    # Get OIDC config - use global config if environment_id is "global" or not a valid UUID
    environment_id = None
    if login_request.environment_id != "global":
        try:
            environment_id = UUID(login_request.environment_id)
        except (ValueError, AttributeError):
            pass

    oidc_config = await auth_service.get_oidc_config(environment_id)
    if not oidc_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC not configured for this environment",
        )

    # Generate state and nonce
    state = generate_token(32)
    nonce = generate_token(32)

    # Get authorization URL (includes PKCE challenge if enabled)
    try:
        authorization_url, pkce_challenge = await auth_service.get_authorization_url(
            oidc_config=oidc_config,
            redirect_uri=login_request.redirect_uri,
            state=state,
            nonce=nonce,
        )
    except ValueError as e:
        # Connection errors to Identity Provider
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    # Store state for verification (including PKCE code_verifier if used)
    _oauth_states[state] = {
        "environment_id": login_request.environment_id,  # "global" or UUID string
        "redirect_uri": login_request.redirect_uri,
        "nonce": nonce,
        "code_verifier": pkce_challenge.code_verifier if pkce_challenge else None,
    }

    return LoginResponse(
        authorization_url=authorization_url,
        state=state,
    )


@router.post("/callback", response_model=TokenResponse)
async def handle_callback(
    request: Request,
    callback: CallbackRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Handle OIDC callback and exchange code for tokens (with PKCE support)."""
    # Verify state
    state_data = _oauth_states.pop(callback.state, None)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state",
        )

    auth_service = AuthService(db)

    # Get OIDC config - handle "global" or UUID string
    env_id_str = state_data["environment_id"]
    environment_id = None
    if env_id_str != "global":
        try:
            environment_id = UUID(env_id_str)
        except (ValueError, AttributeError):
            pass

    oidc_config = await auth_service.get_oidc_config(environment_id)
    if not oidc_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC not configured for this environment",
        )

    try:
        # Complete authentication (with PKCE code_verifier if available)
        user, token_pair, session = await auth_service.authenticate_oidc(
            oidc_config=oidc_config,
            code=callback.code,
            redirect_uri=state_data["redirect_uri"],
            code_verifier=state_data.get("code_verifier"),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            environment_id=environment_id,
        )

        # Set session cookie
        _set_session_cookie(response, token_pair.access_token)

        return TokenResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type=token_pair.token_type,
            expires_in=token_pair.expires_in,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: Request,
    refresh_request: RefreshRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Refresh access token using refresh token."""
    auth_service = AuthService(db)

    result = await auth_service.refresh_tokens(
        refresh_token=refresh_request.refresh_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    token_pair, session = result

    # Set session cookie
    _set_session_cookie(response, token_pair.access_token)

    return TokenResponse(
        access_token=token_pair.access_token,
        refresh_token=token_pair.refresh_token,
        token_type=token_pair.token_type,
        expires_in=token_pair.expires_in,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Logout current session."""
    # Get token from header or cookie
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    await auth_service.logout(token)

    # Clear session cookie
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
    )

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Get current authenticated user."""
    from app.repositories.user import UserRepository

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Fetch user with roles
    user_repo = UserRepository(db)
    user_with_roles = await user_repo.get_with_roles(user.id)

    # Build roles list
    roles: list[UserRoleInfo] = []
    if user_with_roles and user_with_roles.user_roles:
        for user_role in user_with_roles.user_roles:
            if user_role.role:
                roles.append(
                    UserRoleInfo(
                        id=str(user_role.role.id),
                        name=user_role.role.name,
                    )
                )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        is_global_admin=user.is_global_admin,
        roles=roles,
    )


@router.get("/sessions", response_model=SessionsResponse)
async def get_user_sessions(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionsResponse:
    """Get all sessions for the current user."""
    from app.services.session import SessionService

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    session_service = SessionService(db)
    sessions = await session_service.get_user_sessions(user.id)

    # Get current session hash for comparison
    current_token_hash = hash_value(token)

    session_infos = [
        SessionInfo(
            id=str(s.id),
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            created_at=s.created_at.isoformat(),
            expires_at=s.expires_at.isoformat(),
            is_current=s.access_token_hash == current_token_hash,
        )
        for s in sessions
    ]

    return SessionsResponse(sessions=session_infos)


@router.delete("/sessions/{session_id}")
async def revoke_session(
    request: Request,
    session_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Revoke a specific session."""
    from app.services.session import SessionService

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    session_service = SessionService(db)
    session = await session_service.get_session(session_id)

    if not session or session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    await session_service.revoke_session(session_id)

    return {"message": "Session revoked successfully"}


@router.delete("/sessions")
async def revoke_all_other_sessions(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Revoke all sessions for the current user except the current one."""
    from app.services.session import SessionService

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    session_service = SessionService(db)
    current_token_hash = hash_value(token)
    
    count = await session_service.revoke_other_user_sessions(user.id, current_token_hash)

    return {
        "message": f"Successfully revoked {count} other sessions",
        "revoked_count": count
    }


@router.get("/preferences/theme", response_model=ThemePreferenceResponse)
async def get_theme_preference(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ThemePreferenceResponse:
    """Get current user's theme preference."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return ThemePreferenceResponse(
        theme=user.theme_preference,
        mode=user.theme_mode,
    )


@router.put("/preferences/theme", response_model=ThemePreferenceResponse)
async def update_theme_preference(
    request: Request,
    theme_request: ThemePreferenceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ThemePreferenceResponse:
    """Update current user's theme preference."""
    from app.repositories.user import UserRepository

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Update user preferences
    user_repo = UserRepository(db)
    
    update_data = {}
    if theme_request.theme is not None:
        update_data["theme_preference"] = theme_request.theme
    if theme_request.mode is not None:
        update_data["mode"] = theme_request.mode
    
    if update_data:
        # Direct update via repository
        user.theme_preference = theme_request.theme if theme_request.theme is not None else user.theme_preference
        user.theme_mode = theme_request.mode if theme_request.mode is not None else user.theme_mode
        await db.commit()
        await db.refresh(user)

    return ThemePreferenceResponse(
        theme=user.theme_preference,
        mode=user.theme_mode,
    )


# =============================================================================
# Helper Functions
# =============================================================================


def _extract_token(request: Request) -> str | None:
    """Extract token from request."""
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]

    # Check cookie
    return request.cookies.get(settings.session_cookie_name)


def _set_session_cookie(response: Response, token: str) -> None:
    """Set session cookie on response."""
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        httponly=settings.session_cookie_httponly,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )
