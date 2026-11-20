"""Main Flask application factory and entry point for Cloud File Security System."""

import os
from flask import Flask
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect

from cloud.s3_storage import CloudStorageManager
from config import Config
from database.models import User, db
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.files import files_bp


def create_app(config_object: object = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    CSRFProtect(app)

    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.login_message_category = "warning"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id: str):
        return db.session.get(User, int(user_id))

    app.extensions["cloud_storage"] = CloudStorageManager(
        aws_access_key_id=app.config.get("AWS_ACCESS_KEY_ID", ""),
        aws_secret_access_key=app.config.get("AWS_SECRET_ACCESS_KEY", ""),
        aws_region=app.config.get("AWS_REGION", "us-east-1"),
        bucket_name=app.config.get("AWS_S3_BUCKET", ""),
        local_storage_dir=app.config.get("LOCAL_STORAGE_DIR", "./storage/encrypted"),
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(dashboard_bp)

    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
