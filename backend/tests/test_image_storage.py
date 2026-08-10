import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import s3


STORAGE_ENV_KEYS = [
    "S3_BUCKET",
    "S3_REGION",
    "S3_ENDPOINT_URL",
    "S3_PUBLIC_BASE_URL",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "AWS_STORAGE_BUCKET_NAME",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
]


def _clear_storage_env(monkeypatch):
    for key in STORAGE_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_s3_compatible_storage_is_configured_from_spaces_env(monkeypatch):
    _clear_storage_env(monkeypatch)
    monkeypatch.setenv("S3_BUCKET", "dokploy-data")
    monkeypatch.setenv("S3_ENDPOINT_URL", "https://sfo3.digitaloceanspaces.com")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret")

    assert s3.is_s3_configured() is True


def test_s3_public_base_url_is_used_for_image_urls(monkeypatch):
    _clear_storage_env(monkeypatch)
    monkeypatch.setenv("S3_BUCKET", "dokploy-data")
    monkeypatch.setenv("S3_ENDPOINT_URL", "https://sfo3.digitaloceanspaces.com")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://dokploy-data.sfo3.digitaloceanspaces.com/")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret")

    assert (
        s3.get_presigned_url("user-id/image.jpg")
        == "https://dokploy-data.sfo3.digitaloceanspaces.com/user-id/image.jpg"
    )


def test_supabase_storage_still_configures_legacy_fallback(monkeypatch):
    _clear_storage_env(monkeypatch)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role")

    assert s3.is_s3_configured() is True


def test_storage_status_reports_missing_s3_keys_without_secret_values(monkeypatch):
    _clear_storage_env(monkeypatch)
    monkeypatch.setenv("S3_BUCKET", "dokploy-data")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://dokploy-data.sfo3.digitaloceanspaces.com")

    status = s3.get_storage_status()

    assert status["configured"] is False
    assert status["provider"] == "none"
    assert status["s3"]["configured"] is False
    assert status["s3"]["missing"] == ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]
    assert "dokploy-data" in status["s3"]["publicBaseUrl"]
