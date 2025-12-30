"""Authentication service for OIDC and session management."""

import httpx
from datetime import datetime, timedelta, timezone

from app.core.logging import get_logger

logger = get_logger(__name__)
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
    hash_value,
    encrypt_value,
    decrypt_value,
    TokenPair,
    generate_pkce_challenge,
    PKCEChallenge,
)
from app.models.user import User
from app.models.session import Session
from app.models.oidc_provider import OIDCProvider
from app.repositories.user import UserRepository
from app.repositories.session import SessionRepository
from app.repositories.oidc_provider import OIDCProviderRepository


class OIDCConfig:
    """OIDC provider configuration."""

    def __init__(
        self,
        issuer_url: str,
        client_id: str,
        client_secret: str | None = None,
        scopes: list[str] | None = None,
        role_claim: str = "groups",
        use_pkce: bool = True,
    ):
        self.issuer_url = issuer_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes or ["openid", "profile", "email"]
        self.role_claim = role_claim
        self.use_pkce = use_pkce
        self._metadata: dict[str, Any] | None = None

    async def get_metadata(self) -> dict[str, Any]:
        """Fetch OIDC provider metadata from well-known endpoint."""
        if self._metadata:
            return self._metadata

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.issuer_url}/.well-known/openid-configuration",
                timeout=10.0,
            )
            response.raise_for_status()
            self._metadata = response.json()
            return self._metadata

    @property
    def authorization_endpoint(self) -> str | None:
        """Get authorization endpoint from metadata."""
        if self._metadata:
            return self._metadata.get("authorization_endpoint")
        return None

    @property
    def token_endpoint(self) -> str | None:
        """Get token endpoint from metadata."""
        if self._metadata:
            return self._metadata.get("token_endpoint")
        return None

    @property
    def userinfo_endpoint(self) -> str | None:
        """Get userinfo endpoint from metadata."""
        if self._metadata:
            return self._metadata.get("userinfo_endpoint")
        return None

    @property
    def jwks_uri(self) -> str | None:
        """Get JWKS URI from metadata."""
        if self._metadata:
            return self._metadata.get("jwks_uri")
        return None


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.session_repo = SessionRepository(db)
        self.oidc_provider_repo = OIDCProviderRepository(db)

    # =========================================================================
    # OIDC Flow
    # =========================================================================

    async def get_oidc_config(self, environment_id: UUID | None = None) -> OIDCConfig | None:
        """
        Get OIDC configuration for an environment.

        If no environment_id is provided or no environment-specific config exists,
        falls back to global OIDC settings from environment variables.
        """
        # Try environment-specific config first
        if environment_id:
            provider = await self.oidc_provider_repo.get_for_environment(environment_id)
            if provider and provider.is_enabled:
                # Client secret is optional when using PKCE
                client_secret = None
                if provider.client_secret_encrypted:
                    try:
                        client_secret = decrypt_value(provider.client_secret_encrypted)
                    except ValueError:
                        pass  # Secret not configured, will use PKCE

                # Use PKCE if enabled on provider or if no client secret
                use_pkce = getattr(provider, "use_pkce", True) or not client_secret

                return OIDCConfig(
                    issuer_url=provider.issuer_url,
                    client_id=provider.client_id,
                    client_secret=client_secret,
                    scopes=provider.scopes,
                    role_claim=provider.role_claim,
                    use_pkce=use_pkce,
                )

        # Fall back to global OIDC settings from environment variables
        if settings.oidc_enabled and settings.oidc_issuer_url and settings.oidc_client_id:
            return OIDCConfig(
                issuer_url=settings.oidc_issuer_url,
                client_id=settings.oidc_client_id,
                client_secret=settings.oidc_client_secret,
                use_pkce=settings.oidc_use_pkce,
            )

        return None

    async def get_authorization_url(
        self,
        oidc_config: OIDCConfig,
        redirect_uri: str,
        state: str,
        nonce: str | None = None,
    ) -> tuple[str, PKCEChallenge | None]:
        """
        Generate OIDC authorization URL.

        Returns:
            Tuple of (authorization_url, pkce_challenge).
            pkce_challenge is None if PKCE is not enabled.
        """
        metadata = await oidc_config.get_metadata()
        auth_endpoint = metadata["authorization_endpoint"]

        params = {
            "client_id": oidc_config.client_id,
            "response_type": "code",
            "scope": " ".join(oidc_config.scopes),
            "redirect_uri": redirect_uri,
            "state": state,
        }

        if nonce:
            params["nonce"] = nonce

        # Add PKCE parameters if enabled
        pkce_challenge = None
        if oidc_config.use_pkce:
            pkce_challenge = generate_pkce_challenge()
            params["code_challenge"] = pkce_challenge.code_challenge
            params["code_challenge_method"] = pkce_challenge.code_challenge_method

        query = urlencode(params)
        return f"{auth_endpoint}?{query}", pkce_challenge

    async def exchange_code_for_tokens(
        self,
        oidc_config: OIDCConfig,
        code: str,
        redirect_uri: str,
        code_verifier: str | None = None,
    ) -> dict[str, Any]:
        """
        Exchange authorization code for tokens.

        Args:
            oidc_config: OIDC provider configuration
            code: Authorization code from callback
            redirect_uri: Redirect URI used in authorization
            code_verifier: PKCE code verifier (required if PKCE was used)

        Returns:
            Token response from OIDC provider
        """
        metadata = await oidc_config.get_metadata()
        token_endpoint = metadata["token_endpoint"]

        # Build token request data
        data = {
            "grant_type": "authorization_code",
            "client_id": oidc_config.client_id,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        # Use PKCE code_verifier if provided, otherwise use client_secret
        if code_verifier:
            data["code_verifier"] = code_verifier
        elif oidc_config.client_secret:
            data["client_secret"] = oidc_config.client_secret

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_endpoint,
                data=data,
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_userinfo(
        self,
        oidc_config: OIDCConfig,
        access_token: str,
    ) -> dict[str, Any]:
        """Get user info from OIDC provider."""
        metadata = await oidc_config.get_metadata()
        userinfo_endpoint = metadata["userinfo_endpoint"]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()

    async def authenticate_oidc(
        self,
        oidc_config: OIDCConfig,
        code: str,
        redirect_uri: str,
        code_verifier: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, TokenPair, Session]:
        """
        Complete OIDC authentication flow.

        Args:
            oidc_config: OIDC provider configuration
            code: Authorization code from callback
            redirect_uri: Redirect URI used in authorization
            code_verifier: PKCE code verifier (required if PKCE was used)
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            Tuple of (user, token_pair, session)
        """
        # Exchange code for tokens
        tokens = await self.exchange_code_for_tokens(
            oidc_config, code, redirect_uri, code_verifier
        )

        # Get user info
        userinfo = await self.get_userinfo(
            oidc_config, tokens["access_token"]
        )

        # Find or create user
        user, created, is_first_user = await self.user_repo.find_or_create_from_oidc(
            subject=userinfo["sub"],
            issuer=oidc_config.issuer_url,
            email=userinfo.get("email", ""),
            display_name=userinfo.get("name"),
            avatar_url=userinfo.get("picture"),
        )

        # If this is the first user, they are automatically a global admin
        # (handled in UserRepository.find_or_create_from_oidc)
        if is_first_user:
            logger.info(
                "First user created as global admin",
                user_id=str(user.id),
                email=user.email,
            )
            # Assign superuser role to all environments for the first user
            from app.services.seed import SeedService
            seed_service = SeedService(self.db)
            await seed_service.assign_user_to_superuser_role_all_environments(user.id)

        # Create session
        token_pair, session = await self.create_session(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
            oidc_refresh_token=tokens.get("refresh_token"),
        )

        await self.db.commit()

        return user, token_pair, session

    # =========================================================================
    # Session Management
    # =========================================================================

    async def create_session(
        self,
        user: User,
        ip_address: str | None = None,
        user_agent: str | None = None,
        oidc_refresh_token: str | None = None,
    ) -> tuple[TokenPair, Session]:
        """
        Create a new session for a user.

        Args:
            user: The user to create a session for
            ip_address: Client IP address
            user_agent: Client user agent
            oidc_refresh_token: Optional OIDC refresh token to store

        Returns:
            Tuple of (token_pair, session)
        """
        # Create access token
        access_token = create_access_token(user.id)

        # Create refresh token
        refresh_token, jti = create_refresh_token(user.id)

        # Calculate expiration
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )

        # Encrypt refresh token if storing OIDC token
        refresh_token_encrypted = None
        if oidc_refresh_token:
            refresh_token_encrypted = encrypt_value(oidc_refresh_token)

        # Create session record
        session = await self.session_repo.create(
            user_id=user.id,
            access_token_hash=hash_value(access_token),
            refresh_token_encrypted=refresh_token_encrypted,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        token_pair = TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.jwt_access_token_expire_minutes * 60,
        )

        return token_pair, session

    async def validate_access_token(self, token: str) -> User | None:
        """
        Validate an access token and return the user.

        Args:
            token: The access token to validate

        Returns:
            User if valid, None otherwise
        """
        payload = verify_access_token(token)
        if not payload:
            return None

        user = await self.user_repo.get_by_id(UUID(payload.sub))
        if not user or not user.is_active:
            return None

        return user

    async def refresh_tokens(
        self,
        refresh_token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[TokenPair, Session] | None:
        """
        Refresh access token using refresh token.

        Args:
            refresh_token: The refresh token
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            Tuple of (new_token_pair, new_session) or None if invalid
        """
        payload = verify_refresh_token(refresh_token)
        if not payload:
            return None

        user = await self.user_repo.get_by_id(UUID(payload.sub))
        if not user or not user.is_active:
            return None

        # Create new session (old refresh token is now invalid)
        token_pair, session = await self.create_session(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        await self.db.commit()

        return token_pair, session

    async def logout(self, access_token: str) -> bool:
        """
        Logout a user by revoking their session.

        Args:
            access_token: The access token to revoke

        Returns:
            True if session was revoked, False otherwise
        """
        token_hash = hash_value(access_token)
        session = await self.session_repo.get_by_access_token_hash(token_hash)

        if session:
            await self.session_repo.revoke(session.id)
            await self.db.commit()
            return True

        return False

    async def logout_all(self, user_id: UUID) -> int:
        """
        Logout a user from all sessions.

        Args:
            user_id: The user ID to logout

        Returns:
            Number of sessions revoked
        """
        count = await self.session_repo.revoke_all_for_user(user_id)
        await self.db.commit()
        return count

    # =========================================================================
    # User Management
    # =========================================================================

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        """Get a user by ID."""
        return await self.user_repo.get_by_id(user_id)

    async def get_user_by_email(self, email: str) -> User | None:
        """Get a user by email."""
        return await self.user_repo.get_by_email(email)

    async def deactivate_user(self, user_id: UUID) -> User | None:
        """Deactivate a user and revoke all sessions."""
        user = await self.user_repo.deactivate(user_id)
        if user:
            await self.session_repo.revoke_all_for_user(user_id)
            await self.db.commit()
        return user

    # =========================================================================
    # API Token Authentication
    # =========================================================================

    async def validate_api_token(self, token: str) -> User | None:
        """
        Validate an API token and return the user.

        Args:
            token: The API token to validate

        Returns:
            User if valid, None otherwise
        """
        from app.repositories.api_token import ApiTokenRepository

        token_repo = ApiTokenRepository(self.db)
        token_hash = hash_value(token)

        api_token = await token_repo.get_valid_token(token_hash)
        if not api_token:
            return None

        # Update last used timestamp
        await token_repo.update_last_used(api_token.id)

        # Get and return user
        user = await self.user_repo.get_by_id(api_token.user_id)
        if not user or not user.is_active:
            return None

        return user
