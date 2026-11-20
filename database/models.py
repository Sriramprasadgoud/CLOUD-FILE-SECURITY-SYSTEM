"""SQLAlchemy ORM database models for Users, Files, and ActivityLogs."""

from datetime import datetime, timezone
from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    files = db.relationship(
        "FileMetadata", backref="owner", lazy=True, cascade="all, delete-orphan"
    )
    logs = db.relationship(
        "ActivityLog", backref="actor", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)


class FileMetadata(db.Model):
    __tablename__ = "files"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    encrypted_storage_key = db.Column(db.String(512), unique=True, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(128), nullable=False)
    sha256_hash = db.Column(db.String(64), nullable=False)
    encryption_nonce = db.Column(db.String(64), nullable=False)
    storage_provider = db.Column(db.String(16), default="local", nullable=False)
    last_verified_status = db.Column(db.String(32), default="verified", nullable=False)
    last_verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    upload_date = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "original_filename": self.original_filename,
            "encrypted_storage_key": self.encrypted_storage_key,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "sha256_hash": self.sha256_hash,
            "encryption_nonce": self.encryption_nonce,
            "storage_provider": self.storage_provider,
            "last_verified_status": self.last_verified_status,
            "last_verified_at": self.last_verified_at.isoformat() if self.last_verified_at else None,
            "upload_date": self.upload_date.isoformat() if self.upload_date else "",
        }


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = db.Column(db.String(64), nullable=False)
    filename = db.Column(db.String(255), nullable=True)
    timestamp = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    status = db.Column(db.String(32), nullable=False)


def log_activity(user_id: int, action: str, filename: str | None, status: str) -> None:
    entry = ActivityLog(user_id=user_id, action=action, filename=filename, status=status)
    db.session.add(entry)
    db.session.commit()
