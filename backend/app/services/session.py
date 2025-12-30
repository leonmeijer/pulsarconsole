"""Session management service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session
from app.models.user import User
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository


class SessionService:
    """Service for session management operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.user_repo = UserRepository(db)

    async def get_user_sessions(
        self,
        user_id: UUID,
        include_expired: bool = False
    ) -> list[Session]:
        """
        Get all sessions for a user.

        Args:
            user_id: The user ID
            include_expired: Include expired sessions

        Returns:
            List of sessions
        """
        return await self.session_repo.get_user_sessions(
            user_id, include_expired=include_expired
        )

    async def get_session(self, session_id: UUID) -> Session | None:
        """Get a session by ID."""
        return await self.session_repo.get_by_id(session_id)

    async def revoke_session(self, session_id: UUID) -> bool:
        """
        Revoke a specific session.

        Args:
            session_id: The session ID to revoke

        Returns:
            True if revoked, False if not found
        """
        session = await self.session_repo.revoke(session_id)
        if session:
            await self.db.commit()
            return True
        return False

    async def revoke_all_user_sessions(self, user_id: UUID) -> int:
        """
        Revoke all sessions for a user.

        Args:
            user_id: The user ID

        Returns:
            Number of sessions revoked
        """
        count = await self.session_repo.revoke_all_for_user(user_id)
        await self.db.commit()
        return count

    async def revoke_other_user_sessions(self, user_id: UUID, current_token_hash: str) -> int:
        """
        Revoke all sessions for a user except the current one.

        Args:
            user_id: The user ID
            current_token_hash: Hash of the current access token

        Returns:
            Number of sessions revoked
        """
        count = await self.session_repo.revoke_others_for_user(user_id, current_token_hash)
        await self.db.commit()
        return count

    async def cleanup_expired_sessions(self) -> int:
        """
        Remove all expired sessions from the database.

        Returns:
            Number of sessions deleted
        """
        count = await self.session_repo.cleanup_expired()
        await self.db.commit()
        return count

    async def cleanup_revoked_sessions(self) -> int:
        """
        Remove all revoked sessions from the database.

        Returns:
            Number of sessions deleted
        """
        count = await self.session_repo.cleanup_revoked()
        await self.db.commit()
        return count

    async def get_active_session_count(self, user_id: UUID) -> int:
        """
        Get the count of active sessions for a user.

        Args:
            user_id: The user ID

        Returns:
            Number of active sessions
        """
        sessions = await self.session_repo.get_user_sessions(
            user_id, include_expired=False
        )
        return len(sessions)

    async def get_session_details(self, session_id: UUID) -> dict | None:
        """
        Get detailed information about a session.

        Args:
            session_id: The session ID

        Returns:
            Session details dict or None
        """
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None

        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "ip_address": session.ip_address,
            "user_agent": session.user_agent,
            "created_at": session.created_at.isoformat(),
            "expires_at": session.expires_at.isoformat(),
            "is_revoked": session.is_revoked,
            "is_expired": session.is_expired,
            "is_valid": session.is_valid,
        }
