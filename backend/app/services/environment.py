"""Environment service for managing Pulsar cluster configuration."""

import re
from typing import Any
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PulsarConnectionError, ValidationError
from app.core.logging import get_logger
from app.db.seed_data import seed_rbac_data
from app.models.environment import AuthMode, Environment, OIDCMode, RBACSyncMode
from app.repositories.environment import EnvironmentRepository
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Validation patterns
URL_PATTERN = re.compile(
    r"^https?://[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*"
    r"(:\d{1,5})?(/.*)?$"
)


class EnvironmentService:
    """Service for managing Pulsar environment configuration."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = EnvironmentRepository(session)

    def validate_admin_url(self, url: str) -> None:
        """Validate admin URL format."""
        if not url:
            raise ValidationError("Admin URL is required", field="admin_url")

        if not URL_PATTERN.match(url):
            raise ValidationError(
                "Invalid admin URL format. Must be a valid HTTP(S) URL.",
                field="admin_url",
                value=url,
            )

    async def test_connectivity(self, admin_url: str, token: str | None = None) -> tuple[bool, str]:
        """Test connectivity to Pulsar cluster.

        Returns:
            Tuple of (success, message)
        """
        client = PulsarAdminService(admin_url=admin_url, auth_token=token)
        try:
            # Try healthcheck first
            is_healthy = await client.healthcheck()
            if is_healthy:
                return True, "Connection successful"

            # Fallback: try to list clusters
            try:
                clusters = await client.get_clusters()
                if clusters:
                    return True, "Connection successful"
            except Exception as e:
                # If healthcheck failed and clusters failed, use the cluster error
                raise e

            return False, "Broker returned unhealthy status"
        except PulsarConnectionError as e:
            msg = str(e)
            orig = str(e.original_error) if e.original_error else ""
            
            if "401" in msg or "Unauthorized" in msg or "401" in orig:
                return False, "Authentication failed (401 Unauthorized). The broker rejected your token."
            if "403" in msg or "Forbidden" in msg or "403" in orig:
                return False, "Access denied (403 Forbidden). Your token lacks the required permissions."
            
            if "ReadError" in msg or "ReadError" in orig:
                return False, "Broker connection was lost while reading data (ReadError). Is the broker still starting up?"
            if "ConnectError" in msg or "ConnectError" in orig:
                return False, f"Could not connect to the broker at {admin_url}. Is it running and accessible?"
            
            if "No such file or directory" in msg or "No such file or directory" in orig:
                return False, f"Token file not found. Please check the path: {token}"
                
            return False, f"Connection error: {msg} {orig}".strip()
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            logger.warning(
                "Connectivity test failed",
                admin_url=admin_url,
                error_type=error_type,
                error=error_msg,
            )
            return False, f"Unexpected {error_type}: {error_msg}" if error_msg else f"Unexpected {error_type}"
        finally:
            await client.close()

    async def get_environment(self) -> Environment | None:
        """Get the active environment configuration."""
        # First try to get active environment
        env = await self.repository.get_active()
        if env:
            return env

        # Fallback: if no active, get first and set it as active
        envs = await self.repository.get_all(limit=1)
        if envs:
            await self.repository.set_active(envs[0].name)
            return envs[0]
        return None

    async def get_all_environments(self, user_id: uuid.UUID | None = None) -> list[Environment]:
        """Get all environment configurations visible to the user."""
        return await self.repository.get_all_visible(user_id=user_id)

    async def set_active_environment(self, name: str) -> Environment:
        """Set an environment as active."""
        env = await self.repository.set_active(name)
        if env is None:
            raise NotFoundError("environment", name)
        
        # Invalidate all cache to ensure no data from previous environment remains
        from app.services.cache import cache_service
        await cache_service.invalidate_all()
        
        logger.info("Active environment changed", name=name)
        return env

    async def get_environment_with_token(self) -> tuple[Environment | None, str | None]:
        """Get environment with decrypted token."""
        env = await self.get_environment()
        if env is None:
            return None, None

        token = self.repository.get_decrypted_token(env)
        return env, token

    async def create_environment(
        self,
        name: str,
        admin_url: str,
        auth_mode: AuthMode = AuthMode.none,
        oidc_mode: OIDCMode = OIDCMode.none,
        token: str | None = None,
        superuser_token: str | None = None,
        ca_bundle_ref: str | None = None,
        rbac_enabled: bool = False,
        rbac_sync_mode: RBACSyncMode = RBACSyncMode.console_only,
        validate_connectivity: bool = True,
        is_shared: bool = True,
        created_by_id: uuid.UUID | None = None,
    ) -> Environment:
        """Create a new environment configuration."""
        # Validate
        self.validate_admin_url(admin_url)

        if auth_mode == AuthMode.token and not token:
            raise ValidationError(
                "Token is required when auth_mode is 'token'",
                field="token",
            )

        # Test connectivity before saving
        if validate_connectivity:
            # For OIDC passthrough, we can't test connectivity easily during creation
            # without a user token. We'll skip or allow it.
            if auth_mode != AuthMode.oidc or oidc_mode != OIDCMode.passthrough:
                is_connected, error_msg = await self.test_connectivity(admin_url, token)
                if not is_connected:
                    raise PulsarConnectionError(
                        f"Cannot connect to Pulsar cluster: {error_msg}",
                        url=admin_url,
                    )

        # Check if this is the first environment (should be active by default)
        existing = await self.repository.get_all(limit=1)
        is_first = len(existing) == 0

        # Create environment
        env = await self.repository.create_with_encryption(
            name=name,
            admin_url=admin_url,
            auth_mode=auth_mode,
            oidc_mode=oidc_mode,
            token=token,
            superuser_token=superuser_token,
            ca_bundle_ref=ca_bundle_ref,
            rbac_enabled=rbac_enabled,
            rbac_sync_mode=rbac_sync_mode,
            is_shared=is_shared,
            created_by_id=created_by_id,
        )

        # Set as active if first environment
        if is_first:
            await self.repository.set_active(name)
            await self.session.refresh(env)

        # Seed default RBAC roles for this environment
        try:
            await seed_rbac_data(self.session, env.id)
            logger.info("Seeded default RBAC roles for environment", environment=name)
        except Exception as e:
            logger.warning(
                "Failed to seed RBAC roles for environment",
                environment=name,
                error=str(e)
            )

        logger.info("Environment created", name=name, admin_url=admin_url, is_active=is_first)
        return env

    async def update_environment(
        self,
        name: str,
        admin_url: str | None = None,
        auth_mode: AuthMode | None = None,
        oidc_mode: OIDCMode | None = None,
        token: str | None = None,
        superuser_token: str | None = None,
        ca_bundle_ref: str | None = None,
        rbac_enabled: bool | None = None,
        rbac_sync_mode: RBACSyncMode | None = None,
        validate_connectivity: bool = True,
        is_shared: bool | None = None,
    ) -> Environment:
        """Update environment configuration."""
        # Get existing
        env = await self.repository.get_by_name(name)
        if env is None:
            raise NotFoundError("environment", name)

        # Validate new URL if provided
        if admin_url:
            self.validate_admin_url(admin_url)

        # Determine final values for connectivity test
        final_url = admin_url or env.admin_url
        final_token = token if token is not None else self.repository.get_decrypted_token(env)
        final_auth_mode = auth_mode if auth_mode is not None else env.auth_mode
        final_oidc_mode = oidc_mode if oidc_mode is not None else env.oidc_mode

        # Test connectivity before saving
        if validate_connectivity:
            if final_auth_mode != AuthMode.oidc or final_oidc_mode != OIDCMode.passthrough:
                is_connected, error_msg = await self.test_connectivity(final_url, final_token)
                if not is_connected:
                    raise PulsarConnectionError(
                        f"Cannot connect to Pulsar cluster: {error_msg}",
                        url=final_url,
                    )

        # Update
        env = await self.repository.update_with_encryption(
            name=name,
            admin_url=admin_url,
            auth_mode=auth_mode,
            oidc_mode=oidc_mode,
            token=token,
            superuser_token=superuser_token,
            ca_bundle_ref=ca_bundle_ref,
            rbac_enabled=rbac_enabled,
            rbac_sync_mode=rbac_sync_mode,
            is_shared=is_shared,
        )

        logger.info("Environment updated", name=name)
        return env

    async def delete_environment(self, name: str) -> bool:
        """Delete environment configuration."""
        result = await self.repository.delete_by_name(name)
        if result:
            logger.info("Environment deleted", name=name)
        return result

    async def get_pulsar_client(self, user_token: str | None = None) -> PulsarAdminService:
        """Get Pulsar admin client for current environment."""
        env, token = await self.get_environment_with_token()
        if env is None:
            raise NotFoundError("environment", "default")

        # If OIDC passthrough is enabled, use the user's token
        if env.auth_mode == AuthMode.oidc and env.oidc_mode == OIDCMode.passthrough and user_token:
            token = user_token

        return PulsarAdminService(
            admin_url=env.admin_url,
            auth_token=token,
            environment_id=str(env.id)
        )

    async def get_superuser_pulsar_client(self) -> PulsarAdminService:
        """Get Pulsar admin client with superuser token for auth management.

        This uses the superuser token if available, otherwise falls back to
        the regular token.
        """
        env = await self.get_environment()
        if env is None:
            raise NotFoundError("environment", "default")

        token = self.repository.get_decrypted_superuser_token(env)
        return PulsarAdminService(
            admin_url=env.admin_url,
            auth_token=token,
            environment_id=str(env.id)
        )

    async def get_environment_with_superuser_token(
        self,
    ) -> tuple[Environment | None, str | None]:
        """Get environment with decrypted superuser token."""
        env = await self.get_environment()
        if env is None:
            return None, None

        token = self.repository.get_decrypted_superuser_token(env)
        return env, token
