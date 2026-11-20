"""Application configuration loaded strictly from environment variables."""

import base64
import hashlib
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


def _resolve_secret_key() -> str:
    env_secret = os.environ.get("SECRET_KEY", "").strip()
    if env_secret and not env_secret.startswith("CHANGE_ME"):
        return env_secret
    # Ephemeral development secret (never hardcoded in source)
    return secrets.token_hex(32)


def _resolve_encryption_key() -> bytes:
    raw = os.environ.get("ENCRYPTION_KEY", "").strip()
    if raw and not raw.startswith("CHANGE_ME"):
        try:
            if len(raw) == 64:
                return bytes.fromhex(raw)
        except ValueError:
            pass
        try:
            decoded = base64.b64decode(raw)
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass
        return hashlib.sha256(raw.encode("utf-8")).digest()
    # Ephemeral 256-bit key for local test/dev runs when ENCRYPTION_KEY is not provided
    return secrets.token_bytes(32)


class Config:
    SECRET_KEY = _resolve_secret_key()
    ENCRYPTION_KEY = _resolve_encryption_key()

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'cloud_vault.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB limit
    ALLOWED_EXTENSIONS = {
        "pdf", "txt", "md", "csv", "json", "xml", "yaml", "yml", "log",
        "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "png", "jpg", "jpeg", "gif", "webp", "svg",
        "zip", "tar", "gz",
        "py", "js", "ts", "html", "css", "sql",
    }

    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1").strip()
    AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "").strip()

    LOCAL_STORAGE_DIR = os.environ.get(
        "LOCAL_STORAGE_DIR", str(BASE_DIR / "storage" / "encrypted")
    )

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    WTF_CSRF_ENABLED = True
