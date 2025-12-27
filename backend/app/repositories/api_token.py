"""API Token repository for database operations."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_token import ApiToken
from app.repositories.base import BaseRepository


class ApiTokenRepository(BaseRepository[ApiToken]):
    """Repository for ApiToken model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ApiToken, session)

    async def get_by_token_hash(self, token_hash: str) -> ApiToken | None:
        """Get an API token by its hash."""
        result = await self.session.execute(
            select(ApiToken).where(ApiToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_valid_token(self, token_hash: str) -> ApiToken | None:
        """Get a valid (not expired, not revoked) API token."""
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(ApiToken).where(
                ApiToken.token_hash == token_hash,
                ApiToken.is_revoked == False,
                # expires_at can be NULL (never expires)
                (ApiToken.expires_at > now) | (ApiToken.expires_at == None)
            )
        )
        return result.scalar_one_or_none()

    async def get_user_tokens(
        self,
        user_id: UUID,
        include_revoked: bool = False
    ) -> list[ApiToken]:
        """Get all API tokens for a user."""
        query = select(ApiToken).where(ApiToken.user_id == user_id)

        if not include_revoked:
            query = query.where(ApiToken.is_revoked == False)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def revoke(self, token_id: UUID) -> ApiToken | None:
        """Revoke an API token."""
        return await self.update(token_id, is_revoked=True)

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        """Revoke all API tokens for a user. Returns count of revoked tokens."""
        result = await self.session.execute(
            select(ApiToken).where(
                ApiToken.user_id == user_id,
                ApiToken.is_revoked == False
            )
        )
        tokens = list(result.scalars().all())

        for token in tokens:
            token.is_revoked = True

        await self.session.flush()
        return len(tokens)

    async def update_last_used(self, token_id: UUID) -> ApiToken | None:
        """Update the last used timestamp for a token."""
        return await self.update(
            token_id,
            last_used_at=datetime.now(timezone.utc)
        )

    async def get_by_prefix(
        self, user_id: UUID, token_prefix: str
    ) -> list[ApiToken]:
        """Get tokens by prefix for a user (for display purposes)."""
        result = await self.session.execute(
            select(ApiToken).where(
                ApiToken.user_id == user_id,
                ApiToken.token_prefix == token_prefix
            )
        )
        return list(result.scalars().all())
