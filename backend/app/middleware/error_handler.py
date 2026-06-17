"""
Error handling middleware for FastAPI
"""

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from openai import APIError
from app.exceptions import AppError
from app.models.responses import ErrorResponse

logger = logging.getLogger(__name__)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """
    Handle custom AppError exceptions
    """
    logger.error(f"AppError: {exc.message} (status_code: {exc.status_code})")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=f"HTTP {exc.status_code}",
            message=exc.message
        ).model_dump()
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic validation errors
    """
    errors = exc.errors()
    error_messages = []
    
    for error in errors:
        field = ".".join(str(loc) for loc in error.get("loc", []))
        message = error.get("msg", "Validation error")
        error_messages.append(f"{field}: {message}")
    
    error_message = "; ".join(error_messages) if error_messages else "Validation error"
    logger.warning(f"Validation error: {error_message}")
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            error="Validation Error",
            message=error_message
        ).model_dump()
    )


async def openai_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """
    Handle OpenAI API errors
    """
    status_code = 503  # Service Unavailable by default
    
    if exc.status_code == 401:
        logger.error("OpenAI API authentication error")
        status_code = 500  # Internal Server Error (don't expose auth issues)
    elif exc.status_code == 429:
        logger.error("OpenAI API rate limit error")
        status_code = 503
    else:
        logger.error(f"OpenAI API error: {exc.message}")
    
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            error=f"HTTP {status_code}",
            message="Service temporarily unavailable" if status_code == 503 else "Internal server error"
        ).model_dump()
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions
    """
    logger.exception(f"Unexpected error: {exc}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal Server Error",
            message="An unexpected error occurred"
        ).model_dump()
    )
