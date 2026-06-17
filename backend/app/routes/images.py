"""
Image routes for Supabase Storage upload and retrieval.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Request, UploadFile, File
from pydantic import BaseModel

from app.exceptions import AppError
from app.middleware.auth import require_active_subscription
from app.middleware.rate_limiter import limiter, RATE_LIMIT_STR
from app.services.s3 import is_s3_configured, upload_image, get_presigned_url
from app.utils.image import upload_file_to_base64

router = APIRouter()


class ImageUploadResponse(BaseModel):
    key: str
    url: str


class ImageUrlResponse(BaseModel):
    url: str


@router.post("/api/images/upload", response_model=ImageUploadResponse)
@limiter.limit(RATE_LIMIT_STR)
async def upload_image_endpoint(
    request: Request,
    user_id: Annotated[str, Depends(require_active_subscription)],
    image: UploadFile = File(...),
) -> ImageUploadResponse:
    """Upload an image to S3 and return its key and a presigned URL."""
    if not is_s3_configured():
        raise AppError(503, "Image storage is not configured")

    try:
        image_base64 = await upload_file_to_base64(image)
    except ValueError as exc:
        raise AppError(400, str(exc))

    key = await upload_image(image_base64, user_id=user_id)
    url = get_presigned_url(key)

    return ImageUploadResponse(key=key, url=url)


@router.get("/api/images/{key:path}", response_model=ImageUrlResponse)
@limiter.limit(RATE_LIMIT_STR)
async def get_image_url(
    request: Request,
    key: str,
) -> ImageUrlResponse:
    """Get a presigned URL for an existing image."""
    if not is_s3_configured():
        raise AppError(503, "Image storage is not configured")

    url = get_presigned_url(key)
    return ImageUrlResponse(url=url)
