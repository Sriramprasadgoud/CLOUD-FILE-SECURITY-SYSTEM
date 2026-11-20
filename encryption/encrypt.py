"""AES-256-GCM authenticated encryption and decryption utilities."""

import os
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NONCE_SIZE_BYTES = 12  # Standard 96-bit nonce for AES-GCM


def encrypt_file_bytes(plaintext: bytes, key: bytes) -> Tuple[bytes, str]:
    """
    Encrypts plaintext bytes using AES-256-GCM with a unique 96-bit random nonce.

    Args:
        plaintext: Raw file bytes to encrypt.
        key: 32-byte (256-bit) symmetric encryption key.

    Returns:
        Tuple of (ciphertext_with_gcm_tag, nonce_hex).
    """
    if len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte (256-bit) key.")
    nonce = os.urandom(NONCE_SIZE_BYTES)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    return ciphertext, nonce.hex()


def decrypt_file_bytes(ciphertext: bytes, key: bytes, nonce_hex: str) -> bytes:
    """
    Decrypts AES-256-GCM ciphertext and verifies its authentication tag.

    Raises cryptography.exceptions.InvalidTag if ciphertext or nonce was altered.
    """
    if len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte (256-bit) key.")
    nonce = bytes.fromhex(nonce_hex)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, associated_data=None)
