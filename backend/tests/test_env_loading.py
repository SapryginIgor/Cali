import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.env import get_env_file_status, load_backend_env


def test_load_backend_env_reads_explicit_env_file_without_overriding_existing_values(
    monkeypatch,
    tmp_path,
):
    env_file = tmp_path / "backend.env"
    env_file.write_text(
        "S3_BUCKET=dokploy-data\n"
        "S3_ACCESS_KEY_ID=file-key\n"
        "S3_SECRET_ACCESS_KEY=file-secret\n"
    )

    monkeypatch.setenv("BACKEND_ENV_FILE", str(env_file))
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "process-key")
    monkeypatch.delenv("S3_BUCKET", raising=False)
    monkeypatch.delenv("S3_SECRET_ACCESS_KEY", raising=False)

    loaded = load_backend_env()

    assert str(env_file) in loaded
    assert os.getenv("S3_BUCKET") == "dokploy-data"
    assert os.getenv("S3_ACCESS_KEY_ID") == "process-key"
    assert os.getenv("S3_SECRET_ACCESS_KEY") == "file-secret"


def test_env_file_status_reports_configured_candidate(monkeypatch, tmp_path):
    env_file = tmp_path / "backend.env"
    env_file.write_text("S3_BUCKET=dokploy-data\n")
    monkeypatch.setenv("BACKEND_ENV_FILE", str(env_file))

    status = get_env_file_status()

    assert status["configuredPath"] == str(env_file)
    assert str(env_file) in status["existing"]
    assert str(env_file) in status["checked"]
