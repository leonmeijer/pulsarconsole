"""Security utilities for encryption, credential management, and JWT handling."""

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from cryptography.fernet import Fernet, InvalidToken
from pydantic import BaseModel

from app.config import settings


# JWT Token Models
class TokenPayload(BaseModel):
    """JWT token payload."""

    sub: str  # Subject (user ID)
    exp: datetime  # Expiration time
    iat: datetime  # Issued at
    type: str  # Token type: "access" or "refresh"
    jti: str | None = None  # JWT ID (for refresh token tracking)


class TokenPair(BaseModel):
    """Access and refresh token pair."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Access token expiry in seconds


def _get_fernet() -> Fernet:
    """Get Fernet instance with derived key from settings."""
    # Derive a proper 32-byte key from the encryption key
    key = hashlib.sha256(settings.encryption_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def encrypt_value(value: str) -> str:
    """
    Encrypt a sensitive value.

    Args:
        value: The plaintext value to encrypt

    Returns:
        Base64-encoded encrypted value
    """
    if not value:
        return ""

    fernet = _get_fernet()
    encrypted = fernet.encrypt(value.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt an encrypted value.

    Args:
        encrypted_value: Base64-encoded encrypted value

    Returns:
        The decrypted plaintext value

    Raises:
        ValueError: If decryption fails
    """
    if not encrypted_value:
        return ""

    try:
        fernet = _get_fernet()
        decoded = base64.urlsafe_b64decode(encrypted_value.encode())
        decrypted = fernet.decrypt(decoded)
        return decrypted.decode()
    except (InvalidToken, Exception) as e:
        raise ValueError(f"Failed to decrypt value: {e}") from e


def generate_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


def hash_value(value: str) -> str:
    """Create a SHA-256 hash of a value."""
    return hashlib.sha256(value.encode()).hexdigest()


def verify_hash(value: str, hashed: str) -> bool:
    """Verify a value against its hash."""
    return secrets.compare_digest(hash_value(value), hashed)


def mask_sensitive(value: str, visible_chars: int = 4) -> str:
    """
    Mask a sensitive value for logging/display.

    Args:
        value: The value to mask
        visible_chars: Number of characters to show at the end

    Returns:
        Masked value like "****abcd"
    """
    if not value:
        return ""

    if len(value) <= visible_chars:
        return "*" * len(value)

    return "*" * (len(value) - visible_chars) + value[-visible_chars:]


# =============================================================================
# JWT Functions
# =============================================================================


def create_access_token(
    user_id: UUID | str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: The user ID to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "access",
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(
    user_id: UUID | str,
    expires_delta: timedelta | None = None,
) -> tuple[str, str]:
    """
    Create a JWT refresh token.

    Args:
        user_id: The user ID to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Tuple of (encoded JWT token, jti for tracking)
    """
    now = datetime.now(timezone.utc)
    jti = generate_token(16)  # Unique token ID for revocation tracking

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": jti,
    }

    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return token, jti


def create_token_pair(user_id: UUID | str) -> TokenPair:
    """
    Create an access/refresh token pair.

    Args:
        user_id: The user ID to encode in the tokens

    Returns:
        TokenPair with access and refresh tokens
    """
    access_token = create_access_token(user_id)
    refresh_token, _ = create_refresh_token(user_id)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


def decode_token(token: str) -> TokenPayload | None:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode

    Returns:
        TokenPayload if valid, None if invalid/expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_access_token(token: str) -> TokenPayload | None:
    """
    Verify an access token.

    Args:
        token: The access token to verify

    Returns:
        TokenPayload if valid access token, None otherwise
    """
    payload = decode_token(token)
    if payload and payload.type == "access":
        return payload
    return None


def verify_refresh_token(token: str) -> TokenPayload | None:
    """
    Verify a refresh token.

    Args:
        token: The refresh token to verify

    Returns:
        TokenPayload if valid refresh token, None otherwise
    """
    payload = decode_token(token)
    if payload and payload.type == "refresh":
        return payload
    return None


# =============================================================================
# Pulsar JWT Token Generation
# =============================================================================


def create_pulsar_jwt_token(
    subject: str,
    secret_key: str,
    expires_in_days: int | None = None,
    algorithm: str = "HS256",
) -> str:
    """
    Create a Pulsar-compatible JWT token.

    Args:
        subject: The subject (role/principal) for the token
        secret_key: The secret key for signing
        expires_in_days: Optional expiration in days (None = no expiration)
        algorithm: JWT algorithm (HS256, RS256, etc.)

    Returns:
        Encoded JWT token for Pulsar authentication
    """
    now = datetime.now(timezone.utc)

    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
    }

    if expires_in_days:
        payload["exp"] = now + timedelta(days=expires_in_days)

    return jwt.encode(payload, secret_key, algorithm=algorithm)


# =============================================================================
# API Token Functions
# =============================================================================


def generate_api_token() -> tuple[str, str, str]:
    """
    Generate a new API token.

    Returns:
        Tuple of (full_token, token_hash, token_prefix)
    """
    # Generate a secure random token with prefix
    random_part = secrets.token_urlsafe(32)
    full_token = f"pc_{random_part}"  # pc_ prefix for Pulsar Console

    # Hash for storage
    token_hash = hash_value(full_token)

    # Prefix for display
    token_prefix = full_token[:11]  # "pc_" + first 8 chars

    return full_token, token_hash, token_prefix


# =============================================================================
# PKCE (Proof Key for Code Exchange) Functions
# =============================================================================


class PKCEChallenge(BaseModel):
    """PKCE code verifier and challenge pair."""

    code_verifier: str
    code_challenge: str
    code_challenge_method: str = "S256"


def generate_pkce_challenge() -> PKCEChallenge:
    """
    Generate a PKCE code verifier and challenge.

    The code_verifier is a cryptographically random string between 43-128 chars.
    The code_challenge is the Base64-URL-encoded SHA256 hash of the verifier.

    Returns:
        PKCEChallenge with verifier, challenge, and method
    """
    # Generate code_verifier (43-128 characters, using URL-safe base64)
    # 32 bytes = 43 characters in base64url
    code_verifier = secrets.token_urlsafe(32)

    # Generate code_challenge using S256 method
    # SHA256 hash, then base64url encode without padding
    verifier_bytes = code_verifier.encode("ascii")
    sha256_hash = hashlib.sha256(verifier_bytes).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode("ascii").rstrip("=")

    return PKCEChallenge(
        code_verifier=code_verifier,
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )


def verify_pkce_challenge(code_verifier: str, code_challenge: str) -> bool:
    """
    Verify that a code_verifier matches a code_challenge.

    Args:
        code_verifier: The original code verifier
        code_challenge: The code challenge to verify against

    Returns:
        True if the verifier matches the challenge
    """
    verifier_bytes = code_verifier.encode("ascii")
    sha256_hash = hashlib.sha256(verifier_bytes).digest()
    expected_challenge = base64.urlsafe_b64encode(sha256_hash).decode("ascii").rstrip("=")

    return secrets.compare_digest(expected_challenge, code_challenge)
