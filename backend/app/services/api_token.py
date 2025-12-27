"""API Token service for programmatic access and Pulsar JWT generation."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import (
    generate_api_token,
    hash_value,
    verify_hash,
    encrypt_value,
    decrypt_value,
    create_pulsar_jwt_token,
)
from app.models.api_token import ApiToken
from app.models.user import User
from app.models.environment import Environment
from app.repositories.api_token import ApiTokenRepository
from app.repositories.user import UserRepository
from app.repositories.environment import EnvironmentRepository


class ApiTokenService:
    """Service for managing API tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.token_repo = ApiTokenRepository(db)
        self.user_repo = UserRepository(db)
        self.environment_repo = EnvironmentRepository(db)

    # =========================================================================
    # Console API Token Management
    # =========================================================================

    async def create_token(
        self,
        user_id: UUID,
        name: str,
        expires_in_days: int | None = None,
        scopes: list[str] | None = None,
    ) -> tuple[str, ApiToken]:
        """
        Create a new API token for a user.

        Args:
            user_id: The user ID
            name: A friendly name for the token
            expires_in_days: Optional expiration in days (None = never)
            scopes: Optional list of scopes to limit token access

        Returns:
            Tuple of (full_token, api_token_record)
            Note: The full token is only returned once and cannot be retrieved later
        """
        # Verify user exists
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        if not user.is_active:
            raise ValueError("User is not active")

        # Generate token
        full_token, token_hash, token_prefix = generate_api_token()

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        # Create token record
        api_token = await self.token_repo.create(
            user_id=user_id,
            name=name,
            token_hash=token_hash,
            token_prefix=token_prefix,
            expires_at=expires_at,
            scopes=scopes,
        )

        await self.db.commit()

        return full_token, api_token

    async def get_user_tokens(
        self,
        user_id: UUID,
        include_revoked: bool = False,
    ) -> list[ApiToken]:
        """
        Get all API tokens for a user.

        Args:
            user_id: The user ID
            include_revoked: Include revoked tokens

        Returns:
            List of API tokens (without the actual token values)
        """
        return await self.token_repo.get_user_tokens(
            user_id, include_revoked=include_revoked
        )

    async def get_token(self, token_id: UUID) -> ApiToken | None:
        """Get a token by ID."""
        return await self.token_repo.get_by_id(token_id)

    async def validate_token(self, token: str) -> tuple[User, ApiToken] | None:
        """
        Validate an API token and return the associated user.

        Args:
            token: The full API token

        Returns:
            Tuple of (user, api_token) if valid, None otherwise
        """
        token_hash = hash_value(token)
        api_token = await self.token_repo.get_valid_token(token_hash)

        if not api_token:
            return None

        # Update last used timestamp
        await self.token_repo.update_last_used(api_token.id)

        # Get user
        user = await self.user_repo.get_by_id(api_token.user_id)
        if not user or not user.is_active:
            return None

        await self.db.commit()

        return user, api_token

    async def revoke_token(self, token_id: UUID, user_id: UUID) -> bool:
        """
        Revoke an API token.

        Args:
            token_id: The token ID to revoke
            user_id: The user ID (for authorization)

        Returns:
            True if revoked, False if not found or not owned by user
        """
        token = await self.token_repo.get_by_id(token_id)

        if not token:
            return False

        if token.user_id != user_id:
            return False

        await self.token_repo.revoke(token_id)
        await self.db.commit()

        return True

    async def revoke_all_user_tokens(self, user_id: UUID) -> int:
        """
        Revoke all API tokens for a user.

        Args:
            user_id: The user ID

        Returns:
            Number of tokens revoked
        """
        count = await self.token_repo.revoke_all_for_user(user_id)
        await self.db.commit()
        return count

    async def delete_token(self, token_id: UUID, user_id: UUID) -> bool:
        """
        Delete an API token permanently.

        Args:
            token_id: The token ID to delete
            user_id: The user ID (for authorization)

        Returns:
            True if deleted, False if not found or not owned by user
        """
        token = await self.token_repo.get_by_id(token_id)

        if not token:
            return False

        if token.user_id != user_id:
            return False

        await self.token_repo.delete(token_id)
        await self.db.commit()

        return True

    # =========================================================================
    # Pulsar JWT Token Generation
    # =========================================================================

    async def generate_pulsar_token(
        self,
        environment_id: UUID,
        subject: str,
        expires_in_days: int | None = None,
    ) -> str | None:
        """
        Generate a Pulsar JWT token for the specified environment.

        Args:
            environment_id: The environment ID
            subject: The subject (role/principal) for the token
            expires_in_days: Optional expiration in days (None = no expiration)

        Returns:
            The generated JWT token, or None if environment doesn't have a secret key

        Raises:
            ValueError: If environment not found or secret key not configured
        """
        env = await self.environment_repo.get_by_id(environment_id)

        if not env:
            raise ValueError("Environment not found")

        if not env.pulsar_token_secret_key_encrypted:
            raise ValueError(
                "Pulsar token secret key not configured for this environment"
            )

        # Decrypt the secret key
        secret_key = decrypt_value(env.pulsar_token_secret_key_encrypted)

        # Generate the token
        token = create_pulsar_jwt_token(
            subject=subject,
            secret_key=secret_key,
            expires_in_days=expires_in_days,
        )

        return token

    async def can_generate_pulsar_tokens(self, environment_id: UUID) -> bool:
        """
        Check if Pulsar token generation is available for an environment.

        Args:
            environment_id: The environment ID

        Returns:
            True if token generation is available
        """
        env = await self.environment_repo.get_by_id(environment_id)
        return bool(env and env.pulsar_token_secret_key_encrypted)

    async def set_pulsar_token_secret(
        self,
        environment_id: UUID,
        secret_key: str,
    ) -> bool:
        """
        Set the Pulsar token secret key for an environment.

        Args:
            environment_id: The environment ID
            secret_key: The secret key (will be encrypted)

        Returns:
            True if updated successfully
        """
        env = await self.environment_repo.get_by_id(environment_id)

        if not env:
            return False

        encrypted_key = encrypt_value(secret_key)
        await self.environment_repo.update(
            environment_id,
            pulsar_token_secret_key_encrypted=encrypted_key,
        )
        await self.db.commit()

        return True

    async def remove_pulsar_token_secret(self, environment_id: UUID) -> bool:
        """
        Remove the Pulsar token secret key from an environment.

        Args:
            environment_id: The environment ID

        Returns:
            True if removed successfully
        """
        env = await self.environment_repo.get_by_id(environment_id)

        if not env:
            return False

        await self.environment_repo.update(
            environment_id,
            pulsar_token_secret_key_encrypted=None,
        )
        await self.db.commit()

        return True

    # =========================================================================
    # Token Statistics
    # =========================================================================

    async def get_token_stats(self, user_id: UUID) -> dict:
        """
        Get token statistics for a user.

        Args:
            user_id: The user ID

        Returns:
            Dict with token statistics
        """
        all_tokens = await self.token_repo.get_user_tokens(
            user_id, include_revoked=True
        )

        active = 0
        revoked = 0
        expired = 0

        for token in all_tokens:
            if token.is_revoked:
                revoked += 1
            elif token.is_expired:
                expired += 1
            else:
                active += 1

        return {
            "total": len(all_tokens),
            "active": active,
            "revoked": revoked,
            "expired": expired,
        }
