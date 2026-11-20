"""AWS S3 encrypted storage integration with local encrypted vault fallback."""

import os
from pathlib import Path
from typing import List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class CloudStorageManager:
    """
    Manages encrypted file blobs in AWS S3 (primary) or a private local vault
    when AWS credentials are not configured in development.
    """

    def __init__(
        self,
        aws_access_key_id: str = "",
        aws_secret_access_key: str = "",
        aws_region: str = "us-east-1",
        bucket_name: str = "",
        local_storage_dir: str = "./storage/encrypted",
    ) -> None:
        self.bucket_name = bucket_name.strip()
        self.aws_region = aws_region.strip() or "us-east-1"
        self.local_storage_dir = Path(local_storage_dir).resolve()
        self.local_storage_dir.mkdir(parents=True, exist_ok=True)

        self.s3_enabled = bool(
            aws_access_key_id.strip() and aws_secret_access_key.strip() and self.bucket_name
        )
        self._client = None
        if self.s3_enabled:
            self._client = boto3.client(
                "s3",
                aws_access_key_id=aws_access_key_id.strip(),
                aws_secret_access_key=aws_secret_access_key.strip(),
                region_name=self.aws_region,
            )

    @property
    def mode(self) -> str:
        return "s3" if self.s3_enabled else "local"

    @staticmethod
    def build_user_key(user_id: int, object_uuid: str) -> str:
        return f"users/{user_id}/vault/{object_uuid}.enc"

    def _safe_local_path(self, storage_key: str) -> Path:
        clean_rel = storage_key.lstrip("/")
        candidate = (self.local_storage_dir / clean_rel).resolve()
        if not str(candidate).startswith(str(self.local_storage_dir)):
            raise ValueError("Invalid local storage path traversal detected.")
        return candidate

    def upload_encrypted(
        self, storage_key: str, ciphertext: bytes, provider_override: Optional[str] = None
    ) -> str:
        provider = provider_override or self.mode
        if provider == "s3":
            if not self._client:
                raise RuntimeError("AWS S3 client is not configured.")
            try:
                self._client.put_object(
                    Bucket=self.bucket_name,
                    Key=storage_key,
                    Body=ciphertext,
                    ContentType="application/octet-stream",
                    ServerSideEncryption="AES256",
                )
                return "s3"
            except (BotoCoreError, ClientError) as exc:
                raise RuntimeError(f"AWS S3 upload failed: {exc}") from exc

        target = self._safe_local_path(storage_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as handle:
            handle.write(ciphertext)
        os.chmod(target, 0o600)
        return "local"

    def download_encrypted(self, storage_key: str, provider: Optional[str] = None) -> bytes:
        target_provider = provider or self.mode
        if target_provider == "s3":
            if not self._client:
                raise RuntimeError("AWS S3 client is not configured.")
            try:
                response = self._client.get_object(Bucket=self.bucket_name, Key=storage_key)
                return response["Body"].read()
            except (BotoCoreError, ClientError) as exc:
                raise RuntimeError(f"AWS S3 download failed: {exc}") from exc

        target = self._safe_local_path(storage_key)
        if not target.exists():
            raise FileNotFoundError("Encrypted object not found in local vault.")
        return target.read_bytes()

    def delete_encrypted(self, storage_key: str, provider: Optional[str] = None) -> None:
        target_provider = provider or self.mode
        if target_provider == "s3":
            if not self._client:
                raise RuntimeError("AWS S3 client is not configured.")
            try:
                self._client.delete_object(Bucket=self.bucket_name, Key=storage_key)
                return
            except (BotoCoreError, ClientError) as exc:
                raise RuntimeError(f"AWS S3 delete failed: {exc}") from exc

        target = self._safe_local_path(storage_key)
        if target.exists():
            target.unlink()

    def list_user_objects(self, user_id: int) -> List[str]:
        prefix = f"users/{user_id}/vault/"
        if self.s3_enabled and self._client:
            resp = self._client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            return [obj["Key"] for obj in resp.get("Contents", []) if "Key" in obj]

        user_dir = self._safe_local_path(prefix)
        if not user_dir.exists():
            return []
        return [f"{prefix}{item.name}" for item in user_dir.iterdir() if item.is_file()]
