"""User repository for database operations."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.user_role import UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        """Get a user by email."""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_subject_and_issuer(
        self, subject: str, issuer: str
    ) -> User | None:
        """Get a user by OIDC subject and issuer."""
        result = await self.session.execute(
            select(User).where(
                User.subject == subject,
                User.issuer == issuer
            )
        )
        return result.scalar_one_or_none()

    async def get_with_roles(self, user_id: UUID) -> User | None:
        """Get a user with their roles loaded."""
        result = await self.session.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role)
            )
        )
        return result.scalar_one_or_none()

    async def get_active_users(
        self, skip: int = 0, limit: int = 100
    ) -> list[User]:
        """Get all active users."""
        result = await self.session.execute(
            select(User)
            .where(User.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_last_login(self, user_id: UUID) -> User | None:
        """Update user's last login timestamp."""
        return await self.update(
            user_id,
            last_login_at=datetime.now(timezone.utc)
        )

    async def deactivate(self, user_id: UUID) -> User | None:
        """Deactivate a user."""
        return await self.update(user_id, is_active=False)

    async def activate(self, user_id: UUID) -> User | None:
        """Activate a user."""
        return await self.update(user_id, is_active=True)

    async def set_global_admin(self, user_id: UUID, is_admin: bool = True) -> User | None:
        """Set or remove global admin status for a user."""
        return await self.update(user_id, is_global_admin=is_admin)

    async def count_all(self) -> int:
        """Count all users in the system."""
        result = await self.session.execute(
            select(func.count(User.id))
        )
        return result.scalar_one()

    async def find_or_create_from_oidc(
        self,
        subject: str,
        issuer: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> tuple[User, bool, bool]:
        """
        Find or create a user from OIDC claims.

        The first user to sign in is automatically assigned the superuser role
        for all environments. Subsequent users start with no roles and need
        to be assigned by an admin.

        Returns:
            Tuple of (user, created, is_first_user) where:
            - created is True if a new user was created
            - is_first_user is True if this was the first user in the system
        """
        user = await self.get_by_subject_and_issuer(subject, issuer)
        if user:
            # Update user info from OIDC
            user.email = email
            if display_name:
                user.display_name = display_name
            if avatar_url:
                user.avatar_url = avatar_url
            user.last_login_at = datetime.now(timezone.utc)
            await self.session.flush()
            return user, False, False

        # Check if this is the first user in the system
        user_count = await self.count_all()
        is_first_user = user_count == 0

        # Create new user - first user becomes global admin
        user = await self.create(
            subject=subject,
            issuer=issuer,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
            last_login_at=datetime.now(timezone.utc),
            is_global_admin=is_first_user,
        )
        return user, True, is_first_user
