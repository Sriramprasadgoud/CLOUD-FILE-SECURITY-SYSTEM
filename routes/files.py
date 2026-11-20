"""Encrypted file upload, download, verification, and deletion routes."""

import io
import uuid
from datetime import datetime, timezone

from flask import (
    Blueprint,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    send_file,
    url_for,
)
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename

from database.models import FileMetadata, db, log_activity
from encryption.encrypt import decrypt_file_bytes, encrypt_file_bytes
from encryption.hashing import calculate_sha256, verify_sha256_integrity

files_bp = Blueprint("files", __name__)


def _allowed_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


@files_bp.route("/upload", methods=["GET", "POST"])
@login_required
def upload_file():
    storage = current_app.extensions["cloud_storage"]
    if request.method == "POST":
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            flash("Please choose a file to upload.", "danger")
            return redirect(url_for("files.upload_file"))

        safe_name = secure_filename(uploaded.filename)
        if not safe_name or not _allowed_file(safe_name):
            log_activity(current_user.id, "FILE_UPLOAD", safe_name or "invalid", "FAILED")
            flash("File extension is not permitted by security policy.", "danger")
            return redirect(url_for("files.upload_file"))

        plaintext = uploaded.read()
        sha256_digest = calculate_sha256(plaintext)
        ciphertext, nonce_hex = encrypt_file_bytes(
            plaintext, current_app.config["ENCRYPTION_KEY"]
        )
        log_activity(current_user.id, "FILE_ENCRYPTION", safe_name, "SUCCESS")

        storage_key = storage.build_user_key(current_user.id, str(uuid.uuid4()))
        provider = storage.upload_encrypted(storage_key, ciphertext)
        log_activity(current_user.id, "CLOUD_UPLOAD", safe_name, "SUCCESS")

        meta = FileMetadata(
            user_id=current_user.id,
            original_filename=safe_name,
            encrypted_storage_key=storage_key,
            file_size=len(plaintext),
            file_type=uploaded.mimetype or "application/octet-stream",
            sha256_hash=sha256_digest,
            encryption_nonce=nonce_hex,
            storage_provider=provider,
            last_verified_status="verified",
            last_verified_at=datetime.now(timezone.utc),
        )
        db.session.add(meta)
        db.session.commit()
        log_activity(current_user.id, "FILE_UPLOAD", safe_name, "SUCCESS")

        flash(f"Encrypted and stored {safe_name} (SHA-256: {sha256_digest[:12]}...).", "success")
        return redirect(url_for("files.list_files"))

    return render_template("upload.html", storage_mode=storage.mode)


@files_bp.route("/files", methods=["GET"])
@login_required
def list_files():
    page = max(1, request.args.get("page", 1, type=int))
    status_filter = request.args.get("status", "all")
    query = FileMetadata.query.filter_by(user_id=current_user.id)
    if status_filter in {"verified", "modified"}:
        query = query.filter_by(last_verified_status=status_filter)
    pagination = query.order_by(FileMetadata.upload_date.desc()).paginate(
        page=page, per_page=10, error_out=False
    )
    return render_template("files.html", pagination=pagination, status_filter=status_filter)


@files_bp.route("/files/<int:file_id>/download", methods=["GET"])
@login_required
def download_file(file_id: int):
    record = FileMetadata.query.filter_by(id=file_id, user_id=current_user.id).first_or_404()
    storage = current_app.extensions["cloud_storage"]

    try:
        encrypted_bytes = storage.download_encrypted(
            record.encrypted_storage_key, record.storage_provider
        )
        plaintext = decrypt_file_bytes(
            encrypted_bytes,
            current_app.config["ENCRYPTION_KEY"],
            record.encryption_nonce,
        )
        log_activity(current_user.id, "FILE_DECRYPTION", record.original_filename, "SUCCESS")

        result = verify_sha256_integrity(record.sha256_hash, plaintext)
        record.last_verified_status = "verified" if result["authentic"] else "modified"
        record.last_verified_at = datetime.now(timezone.utc)
        db.session.commit()

        log_activity(
            current_user.id,
            "INTEGRITY_VERIFICATION",
            record.original_filename,
            "SUCCESS" if result["authentic"] else "WARNING",
        )
        log_activity(current_user.id, "FILE_DOWNLOAD", record.original_filename, "SUCCESS")

        return send_file(
            io.BytesIO(plaintext),
            as_attachment=True,
            download_name=record.original_filename,
            mimetype=record.file_type,
        )
    except Exception as exc:
        log_activity(current_user.id, "FILE_DOWNLOAD", record.original_filename, "FAILED")
        flash(f"Decryption or download failed: {exc}", "danger")
        return redirect(url_for("files.list_files"))


@files_bp.route("/files/<int:file_id>/verify", methods=["POST"])
@login_required
def verify_file(file_id: int):
    record = FileMetadata.query.filter_by(id=file_id, user_id=current_user.id).first_or_404()
    storage = current_app.extensions["cloud_storage"]
    user_files = FileMetadata.query.filter_by(user_id=current_user.id).all()

    try:
        encrypted_bytes = storage.download_encrypted(
            record.encrypted_storage_key, record.storage_provider
        )
        plaintext = decrypt_file_bytes(
            encrypted_bytes,
            current_app.config["ENCRYPTION_KEY"],
            record.encryption_nonce,
        )
        result = verify_sha256_integrity(record.sha256_hash, plaintext)
        record.last_verified_status = "verified" if result["authentic"] else "modified"
        record.last_verified_at = datetime.now(timezone.utc)
        db.session.commit()

        log_activity(
            current_user.id,
            "INTEGRITY_VERIFICATION",
            record.original_filename,
            "SUCCESS" if result["authentic"] else "WARNING",
        )
        return render_template(
            "verification.html",
            files=user_files,
            selected_file=record,
            result=result,
        )
    except Exception as exc:
        record.last_verified_status = "modified"
        record.last_verified_at = datetime.now(timezone.utc)
        db.session.commit()
        log_activity(current_user.id, "INTEGRITY_VERIFICATION", record.original_filename, "FAILED")
        return render_template(
            "verification.html",
            files=user_files,
            selected_file=record,
            result={
                "original_hash": record.sha256_hash,
                "computed_hash": f"GCM_AUTH_FAILED ({exc})",
                "authentic": False,
                "status": "Modified / Corrupted",
            },
        )


@files_bp.route("/files/<int:file_id>/delete", methods=["POST"])
@login_required
def delete_file(file_id: int):
    record = FileMetadata.query.filter_by(id=file_id, user_id=current_user.id).first_or_404()
    storage = current_app.extensions["cloud_storage"]

    try:
        storage.delete_encrypted(record.encrypted_storage_key, record.storage_provider)
        filename = record.original_filename
        db.session.delete(record)
        db.session.commit()
        log_activity(current_user.id, "FILE_DELETE", filename, "SUCCESS")
        flash(f"Deleted encrypted file {filename}.", "success")
    except Exception as exc:
        log_activity(current_user.id, "FILE_DELETE", record.original_filename, "FAILED")
        flash(f"Deletion failed: {exc}", "danger")

    return redirect(url_for("files.list_files"))
