"""
Food analysis route
Handles POST /api/analyze-food with image uploads (base64 or multipart)
"""

from fastapi import APIRouter, Request
from typing import Optional
from app.models.requests import AnalyzeFoodRequest
from app.models.responses import AnalyzeFoodResponse
from app.services.openai import analyze_food_image
from app.middleware.rate_limiter import limiter, RATE_LIMIT_STR
from app.utils.image import upload_file_to_base64, validate_base64_image_format
from app.exceptions import AppError

router = APIRouter()


@router.post("/api/analyze-food", response_model=AnalyzeFoodResponse)
@limiter.limit(RATE_LIMIT_STR)
async def analyze_food(
    request: Request
) -> AnalyzeFoodResponse:
    """
    Analyze food image from base64 JSON or multipart form data
    Accepts either:
    - JSON body with base64 image: { image: "base64string", description?: "text" }
    - Multipart form data with image file and optional description field
    """
    image_base64: str
    desc: Optional[str] = None

    # Check content type to determine if multipart or JSON
    content_type = request.headers.get("content-type", "")
    is_multipart = "multipart/form-data" in content_type

    if is_multipart:
        form = await request.form()
        image_file = form.get("image")
        if not image_file or not hasattr(image_file, "read"):
            raise AppError(400, "Image file is required")

        try:
            image_base64 = await upload_file_to_base64(image_file)
        except ValueError as exc:
            raise AppError(400, str(exc))

        desc_value = form.get("description")
        if desc_value is not None:
            desc = str(desc_value)
    else:
        body_data = await request.json()
        try:
            body = AnalyzeFoodRequest(**body_data)
        except Exception as exc:
            raise AppError(400, f"Validation failed: {exc}")
        image_base64 = body.image
        desc = body.description

    if not validate_base64_image_format(image_base64):
        raise AppError(400, "Unsupported image format. Supported formats: JPEG, PNG, WebP")

    result = await analyze_food_image(image_base64, desc)
    return AnalyzeFoodResponse(**result.model_dump())
