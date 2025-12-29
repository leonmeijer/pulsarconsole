"""Unit tests for dev user authentication when OIDC is disabled.

These tests ensure that:
1. A system user is created when OIDC is disabled
2. The system user has is_global_admin=True
3. API endpoints are accessible without explicit authentication when OIDC is disabled
"""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import _get_or_create_dev_user
from app.models.user import User


class TestDevUserCreation:
    """Tests for dev user creation when OIDC is disabled."""

    @pytest.mark.asyncio
    async def test_dev_user_is_created_with_correct_attributes(
        self, db_session: AsyncSession
    ):
        """Test that dev user is created with correct email and display name."""
        user = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        assert user is not None
        assert user.email == "system@localhost"
        assert user.subject == "system"
        assert user.issuer == "local"
        assert user.display_name == "SYSTEM"
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_dev_user_has_global_admin_flag(self, db_session: AsyncSession):
        """Test that dev user is created with is_global_admin=True.
        
        This is critical - without this flag, the user cannot access any
        endpoints when no environments/roles exist yet.
        """
        user = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        assert user.is_global_admin is True, (
            "Dev user must have is_global_admin=True to access API "
            "when no environments or roles exist"
        )

    @pytest.mark.asyncio
    async def test_dev_user_is_reused_on_subsequent_calls(
        self, db_session: AsyncSession
    ):
        """Test that the same dev user is returned on multiple calls."""
        user1 = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        user2 = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        assert user1.id == user2.id
        assert user1.email == user2.email

    @pytest.mark.asyncio
    async def test_existing_dev_user_gets_global_admin_flag(
        self, db_session: AsyncSession
    ):
        """Test that existing dev user without global_admin gets the flag set.
        
        This handles migration case where user exists but flag was not set.
        """
        # Create user without global admin flag
        existing_user = User(
            email="system@localhost",
            subject="system",
            issuer="local",
            display_name="SYSTEM",
            is_active=True,
            is_global_admin=False,
        )
        db_session.add(existing_user)
        await db_session.commit()
        await db_session.refresh(existing_user)

        # Call the function - should update the flag
        user = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        assert user.id == existing_user.id
        assert user.is_global_admin is True, (
            "Existing dev user must be upgraded to is_global_admin=True"
        )


class TestDevUserApiAccess:
    """Tests for API access with dev user when OIDC is disabled."""

    @pytest.mark.asyncio
    async def test_environment_endpoint_accessible(self, async_client):
        """Test that environment list endpoint is accessible without auth."""
        response = await async_client.get("/api/v1/environment/all")
        
        # Should not return 401 Unauthorized
        assert response.status_code != 401, (
            "Environment endpoint should be accessible when OIDC is disabled"
        )

    @pytest.mark.asyncio
    async def test_health_endpoint_accessible(self, async_client):
        """Test that health endpoint is accessible."""
        response = await async_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestDevUserWithNoRoles:
    """Tests ensuring dev user works even without any roles assigned."""

    @pytest.mark.asyncio
    async def test_dev_user_works_without_superuser_role(
        self, db_session: AsyncSession
    ):
        """Test that dev user is functional even when no superuser role exists.
        
        This is the bootstrap case - no environments means no roles,
        but the global_admin flag should grant full access.
        """
        # Don't create any roles - simulate fresh database
        user = await _get_or_create_dev_user(db_session)
        await db_session.commit()

        # User should still be created and have global admin
        assert user is not None
        assert user.is_global_admin is True

        # Verify no roles are assigned (none exist)
        from app.models.user_role import UserRole
        result = await db_session.execute(
            select(UserRole).where(UserRole.user_id == user.id)
        )
        roles = result.scalars().all()
        
        # Should have no roles but still work due to global_admin
        assert len(roles) == 0
