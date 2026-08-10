"""
Image storage service.

Prefers S3-compatible storage (DigitalOcean Spaces, AWS S3, etc.) when
configured, and falls back to Supabase Storage for older deployments.
"""

import asyncio
import base64
import logging
import os
import uuid
from typing import Optional

from supabase import create_client

logger = logging.getLogger(__name__)

BUCKET_NAME = "food-images"

_supabase_client = None
_s3_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        _supabase_client = create_client(url, key)
    return _supabase_client


def _env_first(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value.strip()
    return ""


def _s3_bucket_name() -> str:
    return _env_first("S3_BUCKET", "AWS_STORAGE_BUCKET_NAME", "DO_SPACES_BUCKET")


def _s3_public_base_url() -> str:
    return _env_first("S3_PUBLIC_BASE_URL", "DO_SPACES_PUBLIC_URL", "AWS_S3_PUBLIC_BASE_URL").rstrip("/")


def get_storage_status() -> dict[str, object]:
    """Return non-secret image storage diagnostics for deployment checks."""
    s3_required = {
        "S3_BUCKET": _s3_bucket_name(),
        "S3_ACCESS_KEY_ID": _env_first("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "DO_SPACES_KEY"),
        "S3_SECRET_ACCESS_KEY": _env_first("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "DO_SPACES_SECRET"),
    }
    s3_optional = {
        "S3_REGION": _env_first("S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION", "DO_SPACES_REGION"),
        "S3_ENDPOINT_URL": _env_first("S3_ENDPOINT_URL", "AWS_S3_ENDPOINT_URL", "DO_SPACES_ENDPOINT"),
        "S3_PUBLIC_BASE_URL": _s3_public_base_url(),
    }
    missing_s3 = [name for name, value in s3_required.items() if not value]
    supabase_configured = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    provider = "s3" if not missing_s3 else "supabase" if supabase_configured else "none"

    return {
        "configured": provider != "none",
        "provider": provider,
        "s3": {
            "configured": not missing_s3,
            "missing": missing_s3,
            "hasRegion": bool(s3_optional["S3_REGION"]),
            "hasEndpointUrl": bool(s3_optional["S3_ENDPOINT_URL"]),
            "hasPublicBaseUrl": bool(s3_optional["S3_PUBLIC_BASE_URL"]),
            "publicBaseUrl": s3_optional["S3_PUBLIC_BASE_URL"] or None,
        },
        "supabase": {
            "configured": supabase_configured,
        },
    }


def _is_s3_compatible_configured() -> bool:
    return bool(
        _s3_bucket_name()
        and _env_first("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "DO_SPACES_KEY")
        and _env_first("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "DO_SPACES_SECRET")
    )


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3-compatible image storage") from exc

        endpoint_url = _env_first("S3_ENDPOINT_URL", "AWS_S3_ENDPOINT_URL", "DO_SPACES_ENDPOINT")
        region_name = _env_first("S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION", "DO_SPACES_REGION") or "us-east-1"
        access_key_id = _env_first("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "DO_SPACES_KEY")
        secret_access_key = _env_first("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "DO_SPACES_SECRET")

        _s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            region_name=region_name,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
    return _s3_client


def is_s3_configured() -> bool:
    """Check whether image storage is configured."""
    return _is_s3_compatible_configured() or bool(
        os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


async def upload_image(image_base64: str, user_id: Optional[str] = None) -> str:
    """Upload a base64-encoded image to configured image storage.

    Args:
        image_base64: Base64 string, optionally with data URI prefix.
        user_id: Optional user ID used as a path prefix.

    Returns:
        The storage path (e.g. "user123/abc123.jpg").
    """
    # Strip data URI prefix if present
    if "," in image_base64:
        header, data = image_base64.split(",", 1)
    else:
        header, data = "", image_base64

    image_bytes = base64.b64decode(data)

    # Determine content type from header or default to jpeg
    content_type = "image/jpeg"
    if header:
        if "image/png" in header:
            content_type = "image/png"
        elif "image/webp" in header:
            content_type = "image/webp"

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    image_id = uuid.uuid4().hex
    prefix = f"{user_id}/" if user_id else ""
    path = f"{prefix}{image_id}.{ext}"

    if _is_s3_compatible_configured():
        bucket = _s3_bucket_name()
        client = _get_s3_client()
        logger.info("[storage] Uploading s3://%s/%s (%d bytes, %s)", bucket, path, len(image_bytes), content_type)
        await asyncio.to_thread(
            client.put_object,
            Bucket=bucket,
            Key=path,
            Body=image_bytes,
            ContentType=content_type,
        )
        logger.info("[storage] Upload complete: %s", path)
        return path

    sb = _get_supabase()

    logger.info("[storage] Uploading %s/%s (%d bytes, %s)", BUCKET_NAME, path, len(image_bytes), content_type)
    sb.storage.from_(BUCKET_NAME).upload(
        path,
        image_bytes,
        file_options={"content-type": content_type},
    )
    logger.info("[storage] Upload complete: %s", path)

    return path


def get_presigned_url(path: str, expires_in: int = 3600) -> str:
    """Generate a URL for a stored image.

    Args:
        path: The storage path within the bucket.
        expires_in: URL expiration in seconds (default 1 hour).

    Returns:
        Public URL when S3_PUBLIC_BASE_URL is set, otherwise a signed URL.
    """
    if _is_s3_compatible_configured():
        public_base_url = _s3_public_base_url()
        if public_base_url:
            return f"{public_base_url}/{path.lstrip('/')}"

        return _get_s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _s3_bucket_name(), "Key": path},
            ExpiresIn=expires_in,
        )

    sb = _get_supabase()
    result = sb.storage.from_(BUCKET_NAME).create_signed_url(path, expires_in)
    return result["signedURL"]


def delete_image(path: str) -> None:
    """Delete an image from Supabase Storage."""
    if _is_s3_compatible_configured():
        _get_s3_client().delete_object(Bucket=_s3_bucket_name(), Key=path)
        logger.info("[storage] Deleted %s", path)
        return

    sb = _get_supabase()
    sb.storage.from_(BUCKET_NAME).remove([path])
    logger.info("[storage] Deleted %s", path)
