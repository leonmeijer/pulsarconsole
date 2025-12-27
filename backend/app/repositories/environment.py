"""Environment repository for data access."""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.models.environment import AuthMode, Environment
from app.repositories.base import BaseRepository


class EnvironmentRepository(BaseRepository[Environment]):
    """Repository for environment configuration operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Environment, session)

    async def get_by_name(self, name: str) -> Environment | None:
        """Get environment by name."""
        result = await self.session.execute(
            select(Environment).where(Environment.name == name)
        )
        return result.scalar_one_or_none()

    async def create_with_encryption(
        self,
        name: str,
        admin_url: str,
        auth_mode: AuthMode = AuthMode.none,
        token: str | None = None,
        ca_bundle_ref: str | None = None,
    ) -> Environment:
        """Create environment with encrypted token."""
        encrypted_token = encrypt_value(token) if token else None

        return await self.create(
            name=name,
            admin_url=admin_url,
            auth_mode=auth_mode,
            token_encrypted=encrypted_token,
            ca_bundle_ref=ca_bundle_ref,
        )

    async def update_with_encryption(
        self,
        name: str,
        admin_url: str | None = None,
        auth_mode: AuthMode | None = None,
        token: str | None = None,
        ca_bundle_ref: str | None = None,
    ) -> Environment | None:
        """Update environment with encrypted token."""
        env = await self.get_by_name(name)
        if env is None:
            return None

        if admin_url is not None:
            env.admin_url = admin_url
        if auth_mode is not None:
            env.auth_mode = auth_mode
        if token is not None:
            env.token_encrypted = encrypt_value(token)
        if ca_bundle_ref is not None:
            env.ca_bundle_ref = ca_bundle_ref

        await self.session.flush()
        await self.session.refresh(env)
        return env

    def get_decrypted_token(self, environment: Environment) -> str | None:
        """Get decrypted token from environment."""
        if environment.token_encrypted:
            return decrypt_value(environment.token_encrypted)
        return None

    async def delete_by_name(self, name: str) -> bool:
        """Delete environment by name."""
        env = await self.get_by_name(name)
        if env is None:
            return False

        await self.session.delete(env)
        await self.session.flush()
        return True

    async def get_active(self) -> Environment | None:
        """Get the active environment."""
        result = await self.session.execute(
            select(Environment).where(Environment.is_active == True)
        )
        return result.scalar_one_or_none()

    async def set_active(self, name: str) -> Environment | None:
        """Set an environment as active (deactivates all others)."""
        env = await self.get_by_name(name)
        if env is None:
            return None

        # Deactivate all environments
        await self.session.execute(
            update(Environment).values(is_active=False)
        )

        # Activate the specified environment
        env.is_active = True
        await self.session.flush()
        await self.session.refresh(env)
        return env
