"""OIDC Provider repository for database operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oidc_provider import OIDCProvider
from app.repositories.base import BaseRepository


class OIDCProviderRepository(BaseRepository[OIDCProvider]):
    """Repository for OIDCProvider model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(OIDCProvider, session)

    async def get_for_environment(
        self, environment_id: UUID
    ) -> OIDCProvider | None:
        """Get the OIDC provider for an environment."""
        result = await self.session.execute(
            select(OIDCProvider).where(
                OIDCProvider.environment_id == environment_id
            )
        )
        return result.scalar_one_or_none()

    async def get_enabled_providers(self) -> list[OIDCProvider]:
        """Get all enabled OIDC providers."""
        result = await self.session.execute(
            select(OIDCProvider).where(OIDCProvider.is_enabled == True)
        )
        return list(result.scalars().all())

    async def enable(self, provider_id: UUID) -> OIDCProvider | None:
        """Enable an OIDC provider."""
        return await self.update(provider_id, is_enabled=True)

    async def disable(self, provider_id: UUID) -> OIDCProvider | None:
        """Disable an OIDC provider."""
        return await self.update(provider_id, is_enabled=False)

    async def update_client_secret(
        self, provider_id: UUID, client_secret_encrypted: str
    ) -> OIDCProvider | None:
        """Update the encrypted client secret."""
        return await self.update(
            provider_id,
            client_secret_encrypted=client_secret_encrypted
        )
