"""
Supabase Storage service for image storage.
Handles uploading food images and generating signed URLs for retrieval.
"""

import base64
import logging
import os
import uuid
from typing import Optional

from supabase import create_client

logger = logging.getLogger(__name__)

BUCKET_NAME = "food-images"

_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        _supabase_client = create_client(url, key)
    return _supabase_client


def is_s3_configured() -> bool:
    """Check whether Supabase Storage is available (reuses existing Supabase credentials)."""
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


async def upload_image(image_base64: str, user_id: Optional[str] = None) -> str:
    """Upload a base64-encoded image to Supabase Storage.

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
    """Generate a signed URL for a stored image.

    Args:
        path: The storage path within the bucket.
        expires_in: URL expiration in seconds (default 1 hour).

    Returns:
        Signed URL string.
    """
    sb = _get_supabase()
    result = sb.storage.from_(BUCKET_NAME).create_signed_url(path, expires_in)
    return result["signedURL"]


def delete_image(path: str) -> None:
    """Delete an image from Supabase Storage."""
    sb = _get_supabase()
    sb.storage.from_(BUCKET_NAME).remove([path])
    logger.info("[storage] Deleted %s", path)
