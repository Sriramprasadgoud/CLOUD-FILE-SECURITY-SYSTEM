"""Authentication routes: registration, login, logout, and password rotation."""

import re
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from database.models import User, db, log_activity

auth_bp = Blueprint("auth", __name__)

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        if not USERNAME_RE.match(username):
            flash("Username must be 3-32 alphanumeric characters (._- allowed).", "danger")
            return render_template("register.html")

        if not EMAIL_RE.match(email):
            flash("Please provide a valid email address.", "danger")
            return render_template("register.html")

        if len(password) < 8:
            flash("Password must be at least 8 characters long.", "danger")
            return render_template("register.html")

        if password != confirm:
            flash("Passwords do not match.", "danger")
            return render_template("register.html")

        if User.query.filter((User.username == username) | (User.email == email)).first():
            flash("Username or email is already registered.", "danger")
            return render_template("register.html")

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        log_activity(user.id, "USER_REGISTER", None, "SUCCESS")
        login_user(user)
        flash("Account created and vault initialized.", "success")
        return redirect(url_for("dashboard.index"))

    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        identifier = request.form.get("identifier", "").strip()
        password = request.form.get("password", "")

        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier.lower())
        ).first()

        if not user or not user.check_password(password):
            if user:
                log_activity(user.id, "USER_LOGIN", None, "FAILED")
            flash("Invalid username/email or password.", "danger")
            return render_template("login.html")

        login_user(user)
        log_activity(user.id, "USER_LOGIN", None, "SUCCESS")
        return redirect(url_for("dashboard.index"))

    return render_template("login.html")


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    log_activity(current_user.id, "USER_LOGOUT", None, "SUCCESS")
    logout_user()
    flash("Signed out securely.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/profile/password", methods=["POST"])
@login_required
def update_password():
    current_pw = request.form.get("current_password", "")
    new_pw = request.form.get("new_password", "")
    confirm_pw = request.form.get("confirm_password", "")

    if not current_user.check_password(current_pw):
        log_activity(current_user.id, "PASSWORD_UPDATE", None, "FAILED")
        flash("Current password is incorrect.", "danger")
        return redirect(url_for("dashboard.profile"))

    if len(new_pw) < 8 or new_pw != confirm_pw:
        flash("New password must be at least 8 characters and match confirmation.", "danger")
        return redirect(url_for("dashboard.profile"))

    current_user.set_password(new_pw)
    db.session.commit()
    log_activity(current_user.id, "PASSWORD_UPDATE", None, "SUCCESS")
    flash("Password updated securely.", "success")
    return redirect(url_for("dashboard.profile"))
