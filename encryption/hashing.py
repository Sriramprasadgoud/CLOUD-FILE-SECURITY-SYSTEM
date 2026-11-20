"""SHA-256 cryptographic hashing and integrity verification utilities."""

import hashlib
import hmac
from typing import Dict


def calculate_sha256(data: bytes) -> str:
    """
    Calculates the SHA-256 digest of raw file bytes in memory.
    Uses incremental chunking so large buffers remain memory-safe.
    """
    digest = hashlib.sha256()
    view = memoryview(data)
    chunk_size = 65536
    for offset in range(0, len(view), chunk_size):
        digest.update(view[offset : offset + chunk_size])
    return digest.hexdigest()


def verify_sha256_integrity(original_hash: str, decrypted_data: bytes) -> Dict[str, object]:
    """
    Recomputes SHA-256 on decrypted bytes and performs constant-time comparison
    against the stored original hash.
    """
    computed_hash = calculate_sha256(decrypted_data)
    authentic = hmac.compare_digest(original_hash.lower(), computed_hash.lower())
    return {
        "original_hash": original_hash.lower(),
        "computed_hash": computed_hash.lower(),
        "authentic": authentic,
        "status": "Authentic" if authentic else "Modified",
    }
