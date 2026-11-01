"""Database Administration & Schema Migration Tests: Alembic and Backup Verification."""

import os
import pytest
from alembic.config import Config
from alembic import command
from app.models.db_models import Base


def test_alembic_config_and_metadata():
    """Alembic configuration must successfully load model metadata and target tables."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(backend_dir, "alembic.ini")

    assert os.path.exists(ini_path), "alembic.ini must exist in backend directory"

    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

    # Verify model tables in target_metadata
    table_names = list(Base.metadata.tables.keys())
    assert "users" in table_names
    assert "scan_history" in table_names


def test_backup_and_restore_scripts_exist_and_executable():
    """Backup and recovery bash scripts must be present and contain strict safety flags."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_script = os.path.join(backend_dir, "scripts", "backup_postgres_to_s3.sh")
    restore_script = os.path.join(backend_dir, "scripts", "restore_postgres_from_s3.sh")

    assert os.path.exists(backup_script), "backup_postgres_to_s3.sh must exist"
    assert os.path.exists(restore_script), "restore_postgres_from_s3.sh must exist"

    backup_content = open(backup_script, "r", encoding="utf-8").read()
    restore_content = open(restore_script, "r", encoding="utf-8").read()

    # Safety checks
    assert "set -euo pipefail" in backup_content
    assert "pg_dump" in backup_content
    assert "openssl enc -aes-256-cbc" in backup_content
    assert "aws s3 cp" in backup_content

    assert "set -euo pipefail" in restore_content
    assert "pg_restore" in restore_content
    assert "openssl enc -d -aes-256-cbc" in restore_content
    assert "sha256sum" in restore_content
