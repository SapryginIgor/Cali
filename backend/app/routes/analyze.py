"""
Food analysis route
Handles POST /api/analyze-food with image uploads (base64 or multipart)
"""

import asyncio
import time
import uuid
from fastapi import APIRouter, Request
from typing import Optional
from app.models.requests import AnalyzeFoodRequest
from app.models.responses import AnalyzeFoodResponse, AsyncLogResponse
from app.services.openai import analyze_food_image
from app.middleware.rate_limiter import limiter, RATE_LIMIT_STR
from app.utils.image import upload_file_to_base64, validate_base64_image_format
from app.exceptions import AppError

router = APIRouter()
_log_store: dict[str, dict] = {}
_idempotency_map: dict[str, str] = {}
_log_store_lock = asyncio.Lock()


async def _parse_input_payload(request: Request) -> tuple[str, Optional[str], Optional[str]]:
    image_base64: str
    desc: Optional[str] = None
    idempotency_key: Optional[str] = None

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

    if not validate_base64_image_format(image_base64):
        raise AppError(400, "Unsupported image format. Supported formats: JPEG, PNG, WebP")

    return image_base64, desc, idempotency_key


async def _run_async_analysis(log_id: str, image_base64: str, description: Optional[str]) -> None:
    try:
        result = await analyze_food_image(image_base64, description)
        async with _log_store_lock:
            log = _log_store.get(log_id)
            if not log:
                return
            log["status"] = "completed"
            log["updatedAt"] = time.time()
            log["result"] = result.model_dump()
            log["error"] = None
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
    request: Request
) -> AnalyzeFoodResponse:
    """
    Analyze food image from base64 JSON or multipart form data
    Accepts either:
    - JSON body with base64 image: { image: "base64string", description?: "text" }
    - Multipart form data with image file and optional description field
    """
    image_base64, desc, _ = await _parse_input_payload(request)
    result = await analyze_food_image(image_base64, desc)
    return AnalyzeFoodResponse(**result.model_dump())


@router.post("/api/logs", response_model=AsyncLogResponse)
@limiter.limit(RATE_LIMIT_STR)
async def create_log(
    request: Request
) -> AsyncLogResponse:
    image_base64, desc, idempotency_key = await _parse_input_payload(request)

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

    asyncio.create_task(_run_async_analysis(log_id, image_base64, desc))
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
