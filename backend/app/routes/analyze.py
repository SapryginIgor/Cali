"""
Food analysis route
Handles POST /api/analyze-food with image uploads (base64 or multipart)
"""

import asyncio
import time
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Request

from app.exceptions import AppError
from app.middleware.auth import require_active_subscription
from app.middleware.rate_limiter import limiter, RATE_LIMIT_STR
from app.models.api import NutritionProfile
from app.models.requests import AnalyzeFoodRequest, EditLogRequest, NutritionistChatRequest
from app.models.responses import AnalyzeFoodResponse, AsyncLogResponse, NutritionistChatResponse
from app.services.openai import analyze_food_image, edit_log, nutritionist_chat
from app.services.s3 import is_s3_configured, upload_image, get_presigned_url
from app.utils.image import upload_file_to_base64, validate_base64_image_format

router = APIRouter()
_log_store: dict[str, dict] = {}
_idempotency_map: dict[str, str] = {}
_log_store_lock = asyncio.Lock()


async def _parse_input_payload(
    request: Request,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[NutritionProfile]]:
    image_base64: Optional[str] = None
    desc: Optional[str] = None
    idempotency_key: Optional[str] = None
    nutrition_profile: Optional[NutritionProfile] = None

    content_type = request.headers.get("content-type", "")
    is_multipart = "multipart/form-data" in content_type

    if is_multipart:
        form = await request.form()
        image_file = form.get("image")
        if image_file and hasattr(image_file, "read"):
            try:
                image_base64 = await upload_file_to_base64(image_file)
            except ValueError as exc:
                raise AppError(400, str(exc))

        desc_value = form.get("description")
        if desc_value is not None:
            desc = str(desc_value)
        idempotency_value = form.get("idempotencyKey")
        if idempotency_value is not None:
            idempotency_key = str(idempotency_value).strip() or None
    else:
        body_data = await request.json()
        idempotency_value = body_data.get("idempotencyKey") if isinstance(body_data, dict) else None
        if isinstance(idempotency_value, str):
            idempotency_key = idempotency_value.strip() or None
        try:
            body = AnalyzeFoodRequest(**body_data)
        except Exception as exc:
            raise AppError(400, f"Validation failed: {exc}")
        image_base64 = body.image
        desc = body.description
        nutrition_profile = body.nutritionProfile

    if not image_base64 and not desc:
        raise AppError(400, "Either an image or a description is required")

    if image_base64 and not validate_base64_image_format(image_base64):
        raise AppError(400, "Unsupported image format. Supported formats: JPEG, PNG, WebP")

    return image_base64, desc, idempotency_key, nutrition_profile


async def _run_async_analysis(
    log_id: str,
    image_base64: Optional[str],
    description: Optional[str],
    user_id: Optional[str] = None,
    nutrition_profile: Optional[NutritionProfile] = None,
) -> None:
    try:
        result = await analyze_food_image(image_base64, description, nutrition_profile=nutrition_profile)

        # Upload image to S3 if configured
        image_key: Optional[str] = None
        image_url: Optional[str] = None
        if is_s3_configured():
            try:
                image_key = await upload_image(image_base64, user_id=user_id)
                image_url = get_presigned_url(image_key)
            except Exception:
                pass  # Non-fatal: analysis still succeeds without image storage

        async with _log_store_lock:
            log = _log_store.get(log_id)
            if not log:
                return
            log["status"] = "completed"
            log["updatedAt"] = time.time()
            log["result"] = result.model_dump()
            log["error"] = None
            if image_key:
                log["imageKey"] = image_key
                log["imageUrl"] = image_url
    except Exception as exc:
        async with _log_store_lock:
            log = _log_store.get(log_id)
            if not log:
                return
            log["status"] = "failed"
            log["updatedAt"] = time.time()
            log["error"] = str(exc)


@router.post("/api/analyze-food", response_model=AnalyzeFoodResponse)
@limiter.limit(RATE_LIMIT_STR)
async def analyze_food(
    request: Request,
    _user_id: Annotated[str, Depends(require_active_subscription)],
) -> AnalyzeFoodResponse:
    """
    Analyze food image from base64 JSON or multipart form data
    Accepts either:
    - JSON body with base64 image: { image: "base64string", description?: "text" }
    - Multipart form data with image file and optional description field
    """
    image_base64, desc, _, nutrition_profile = await _parse_input_payload(request)
    result = await analyze_food_image(image_base64, desc, nutrition_profile=nutrition_profile)

    image_url = None
    if is_s3_configured():
        try:
            key = await upload_image(image_base64, user_id=_user_id)
            image_url = get_presigned_url(key)
        except Exception:
            pass  # Non-fatal

    return AnalyzeFoodResponse(**result.model_dump(), imageUrl=image_url)


@router.post("/api/edit-log", response_model=AnalyzeFoodResponse)
@limiter.limit(RATE_LIMIT_STR)
async def edit_log_endpoint(
    request: Request,
    _user_id: Annotated[str, Depends(require_active_subscription)],
) -> AnalyzeFoodResponse:
    """Apply a natural-language correction to existing meal log ingredients."""
    body = await request.json()
    try:
        edit_request = EditLogRequest(**body)
    except Exception as exc:
        raise AppError(400, f"Validation failed: {exc}")

    if edit_request.image and not validate_base64_image_format(edit_request.image):
        raise AppError(400, "Unsupported image format. Supported formats: JPEG, PNG, WebP")

    result = await edit_log(
        edit_request.ingredients,
        edit_request.correction,
        edit_request.image,
        edit_request.sourceUrl,
    )
    return AnalyzeFoodResponse(**result.model_dump())


@router.post("/api/nutritionist-chat", response_model=NutritionistChatResponse)
@limiter.limit(RATE_LIMIT_STR)
async def nutritionist_chat_endpoint(
    request: Request,
    _user_id: Annotated[str, Depends(require_active_subscription)],
) -> NutritionistChatResponse:
    """Reply to the user's AI nutritionist chat."""
    body = await request.json()
    try:
        chat_request = NutritionistChatRequest(**body)
    except Exception as exc:
        raise AppError(400, f"Validation failed: {exc}")

    result = await nutritionist_chat(
        chat_request.messages,
        chat_request.todayTotals,
        chat_request.recentMeals,
        chat_request.goals,
        chat_request.nutritionProfile,
    )
    return NutritionistChatResponse(**result.model_dump())


@router.post("/api/logs", response_model=AsyncLogResponse)
@limiter.limit(RATE_LIMIT_STR)
async def create_log(
    request: Request,
    _user_id: Annotated[str, Depends(require_active_subscription)],
) -> AsyncLogResponse:
    image_base64, desc, idempotency_key, nutrition_profile = await _parse_input_payload(request)

    async with _log_store_lock:
        if idempotency_key and idempotency_key in _idempotency_map:
            existing_log_id = _idempotency_map[idempotency_key]
            existing_log = _log_store.get(existing_log_id)
            if existing_log:
                return AsyncLogResponse(**existing_log)

        log_id = str(uuid.uuid4())
        now = time.time()
        log = {
            "id": log_id,
            "status": "pending",
            "description": desc,
            "createdAt": now,
            "updatedAt": now,
            "result": None,
            "error": None,
        }
        _log_store[log_id] = log
        if idempotency_key:
            _idempotency_map[idempotency_key] = log_id

    asyncio.create_task(
        _run_async_analysis(
            log_id,
            image_base64,
            desc,
            user_id=_user_id,
            nutrition_profile=nutrition_profile,
        )
    )
    return AsyncLogResponse(**log)


@router.get("/api/logs/{log_id}", response_model=AsyncLogResponse)
@limiter.limit(RATE_LIMIT_STR)
async def get_log(
    request: Request,
    log_id: str
) -> AsyncLogResponse:
    del request
    async with _log_store_lock:
        log = _log_store.get(log_id)
        if not log:
            raise AppError(404, "Log not found")
        return AsyncLogResponse(**log)
