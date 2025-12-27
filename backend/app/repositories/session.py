"""Session repository for database operations."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[Session]):
    """Repository for Session model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Session, session)

    async def get_by_access_token_hash(
        self, token_hash: str
    ) -> Session | None:
        """Get a session by access token hash."""
        result = await self.session.execute(
            select(Session).where(Session.access_token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_valid_session(self, token_hash: str) -> Session | None:
        """Get a valid (not expired, not revoked) session."""
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(Session).where(
                Session.access_token_hash == token_hash,
                Session.is_revoked == False,
                Session.expires_at > now
            )
        )
        return result.scalar_one_or_none()

    async def get_user_sessions(
        self,
        user_id: UUID,
        include_expired: bool = False
    ) -> list[Session]:
        """Get all sessions for a user."""
        query = select(Session).where(Session.user_id == user_id)

        if not include_expired:
            now = datetime.now(timezone.utc)
            query = query.where(
                Session.expires_at > now,
                Session.is_revoked == False
            )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def revoke(self, session_id: UUID) -> Session | None:
        """Revoke a session."""
        return await self.update(session_id, is_revoked=True)

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        """Revoke all sessions for a user. Returns count of revoked sessions."""
        result = await self.session.execute(
            select(Session).where(
                Session.user_id == user_id,
                Session.is_revoked == False
            )
        )
        sessions = list(result.scalars().all())

        for sess in sessions:
            sess.is_revoked = True

        await self.session.flush()
        return len(sessions)

    async def cleanup_expired(self) -> int:
        """Delete expired sessions. Returns count of deleted sessions."""
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            delete(Session).where(Session.expires_at < now)
        )
        return result.rowcount

    async def cleanup_revoked(self) -> int:
        """Delete revoked sessions. Returns count of deleted sessions."""
        result = await self.session.execute(
            delete(Session).where(Session.is_revoked == True)
        )
        return result.rowcount
