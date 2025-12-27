"""Security utilities for encryption and credential management."""

import base64
import hashlib
import secrets
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


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
