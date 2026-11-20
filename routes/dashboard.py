"""Dashboard, searching, sorting, verification, logs, and profile views."""

from flask import Blueprint, current_app, render_template, request
from flask_login import current_user, login_required
from sqlalchemy import func

from algorithms.searching import binary_search_files, linear_search_files
from algorithms.sorting import merge_sort_files, quick_sort_files
from database.models import ActivityLog, FileMetadata, db

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
@dashboard_bp.route("/dashboard")
@login_required
def index():
    total_files = FileMetadata.query.filter_by(user_id=current_user.id).count()
    total_storage = (
        db.session.query(func.coalesce(func.sum(FileMetadata.file_size), 0))
        .filter(FileMetadata.user_id == current_user.id)
        .scalar()
    )
    verified_checks = ActivityLog.query.filter_by(
        user_id=current_user.id, action="INTEGRITY_VERIFICATION", status="SUCCESS"
    ).count()
    recent_files = (
        FileMetadata.query.filter_by(user_id=current_user.id)
        .order_by(FileMetadata.upload_date.desc())
        .limit(6)
        .all()
    )
    recent_logs = (
        ActivityLog.query.filter_by(user_id=current_user.id)
        .order_by(ActivityLog.id.desc())
        .limit(8)
        .all()
    )
    storage = current_app.extensions["cloud_storage"]
    return render_template(
        "dashboard.html",
        total_files=total_files,
        total_storage=total_storage,
        encrypted_files=total_files,
        verified_checks=verified_checks,
        storage_mode=storage.mode,
        recent_files=recent_files,
        recent_logs=recent_logs,
    )


@dashboard_bp.route("/search", methods=["GET"])
@login_required
def search_files():
    algorithm = request.args.get("algorithm", "linear")
    query = request.args.get("q", "")
    field = request.args.get("field", "filename")

    records = [f.to_dict() for f in FileMetadata.query.filter_by(user_id=current_user.id).all()]
    results = None
    metrics = None

    if "q" in request.args:
        if algorithm == "binary":
            results, metrics = binary_search_files(records, query)
        else:
            results, metrics = linear_search_files(records, query, field)

    return render_template(
        "search.html",
        algorithm=algorithm,
        query=query,
        field=field,
        results=results,
        metrics=metrics,
    )


@dashboard_bp.route("/sort", methods=["GET"])
@login_required
def sort_files():
    algorithm = request.args.get("algorithm", "merge")
    sort_by = request.args.get("sort_by", "filename")
    order = request.args.get("order", "asc")
    ascending = order != "desc"

    records = [f.to_dict() for f in FileMetadata.query.filter_by(user_id=current_user.id).all()]
    if algorithm == "quick":
        field = "filename" if sort_by == "filename" else "file_size"
        results, metrics = quick_sort_files(records, sort_by=field, ascending=ascending)
    else:
        field = sort_by if sort_by in {"filename", "upload_date", "file_size"} else "filename"
        results, metrics = merge_sort_files(records, sort_by=field, ascending=ascending)

    return render_template(
        "sort.html",
        algorithm=algorithm,
        sort_by=sort_by,
        order=order,
        results=results,
        metrics=metrics,
    )


@dashboard_bp.route("/verification", methods=["GET"])
@login_required
def verification_page():
    user_files = FileMetadata.query.filter_by(user_id=current_user.id).all()
    return render_template("verification.html", files=user_files, selected_file=None, result=None)


@dashboard_bp.route("/logs", methods=["GET"])
@login_required
def activity_logs():
    action_filter = request.args.get("action", "").strip()
    query = ActivityLog.query.filter_by(user_id=current_user.id)
    if action_filter:
        query = query.filter_by(action=action_filter)
    logs = query.order_by(ActivityLog.id.desc()).limit(200).all()
    return render_template("logs.html", logs=logs, action_filter=action_filter)


@dashboard_bp.route("/profile", methods=["GET"])
@login_required
def profile():
    storage = current_app.extensions["cloud_storage"]
    return render_template("profile.html", storage_mode=storage.mode)
