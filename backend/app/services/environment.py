"""Environment service for managing Pulsar cluster configuration."""

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PulsarConnectionError, ValidationError
from app.core.logging import get_logger
from app.models.environment import AuthMode, Environment
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

    async def test_connectivity(self, admin_url: str, token: str | None = None) -> bool:
        """Test connectivity to Pulsar cluster."""
        client = PulsarAdminService(admin_url=admin_url, auth_token=token)
        try:
            is_healthy = await client.healthcheck()
            if not is_healthy:
                # Try to get clusters as fallback
                clusters = await client.get_clusters()
                return len(clusters) > 0
            return True
        except Exception as e:
            logger.warning(
                "Connectivity test failed",
                admin_url=admin_url,
                error=str(e),
            )
            return False
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

    async def get_all_environments(self) -> list[Environment]:
        """Get all environment configurations."""
        return await self.repository.get_all()

    async def set_active_environment(self, name: str) -> Environment:
        """Set an environment as active."""
        env = await self.repository.set_active(name)
        if env is None:
            raise NotFoundError("environment", name)
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
        token: str | None = None,
        ca_bundle_ref: str | None = None,
        validate_connectivity: bool = True,
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
            is_connected = await self.test_connectivity(admin_url, token)
            if not is_connected:
                raise PulsarConnectionError(
                    "Cannot connect to Pulsar cluster. Please verify the URL and credentials.",
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
            token=token,
            ca_bundle_ref=ca_bundle_ref,
        )

        # Set as active if first environment
        if is_first:
            await self.repository.set_active(name)
            await self.session.refresh(env)

        logger.info("Environment created", name=name, admin_url=admin_url, is_active=is_first)
        return env

    async def update_environment(
        self,
        name: str,
        admin_url: str | None = None,
        auth_mode: AuthMode | None = None,
        token: str | None = None,
        ca_bundle_ref: str | None = None,
        validate_connectivity: bool = True,
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

        # Test connectivity before saving
        if validate_connectivity:
            is_connected = await self.test_connectivity(final_url, final_token)
            if not is_connected:
                raise PulsarConnectionError(
                    "Cannot connect to Pulsar cluster. Please verify the URL and credentials.",
                    url=final_url,
                )

        # Update
        env = await self.repository.update_with_encryption(
            name=name,
            admin_url=admin_url,
            auth_mode=auth_mode,
            token=token,
            ca_bundle_ref=ca_bundle_ref,
        )

        logger.info("Environment updated", name=name)
        return env

    async def delete_environment(self, name: str) -> bool:
        """Delete environment configuration."""
        result = await self.repository.delete_by_name(name)
        if result:
            logger.info("Environment deleted", name=name)
        return result

    async def get_pulsar_client(self) -> PulsarAdminService:
        """Get Pulsar admin client for current environment."""
        env, token = await self.get_environment_with_token()
        if env is None:
            raise NotFoundError("environment", "default")

        return PulsarAdminService(admin_url=env.admin_url, auth_token=token)
