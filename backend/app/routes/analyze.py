"""
Food analysis route
Handles POST /api/analyze-food with image uploads (base64 or multipart)
"""

import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
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
    try:
        image_base64: str
        desc: Optional[str] = None
        user_id: Optional[str] = None
        
        # Check content type to determine if multipart or JSON
        content_type = request.headers.get("content-type", "")
        is_multipart = "multipart/form-data" in content_type
        
        if is_multipart:
            # Handle multipart form data
            form = await request.form()
            image_file = form.get("image")
            
            if not image_file or not isinstance(image_file, UploadFile):
                raise AppError(400, "Image file is required")
            
            # Convert UploadFile to base64
            image_base64 = await upload_file_to_base64(image_file)
            desc = form.get("description")
            if desc:
                desc = str(desc)
            user_id = form.get("userId")
            if user_id:
                user_id = str(user_id)
        else:
            # Handle JSON body with base64 image
            body_data = await request.json()
            
            # Validate request body using Pydantic
            try:
                body = AnalyzeFoodRequest(**body_data)
            except Exception as e:
                raise AppError(400, f"Validation failed: {str(e)}")
            
            image_base64 = body.image
            desc = body.description
            user_id = body.userId
        
        # Validate base64 image format
        if not validate_base64_image_format(image_base64):
            raise AppError(400, "Unsupported image format. Supported formats: JPEG, PNG, WebP")
        
        # Call OpenAI service
        result = await analyze_food_image(image_base64, desc)
        
        return AnalyzeFoodResponse(**result.model_dump())
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AppError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Unexpected error in analyze_food: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze food image")
