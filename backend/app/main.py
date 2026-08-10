"""
FastAPI application entry point
"""

import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.routes.analyze import router as analyze_router
from app.routes.images import router as images_router
from app.services.s3 import get_storage_status
from app.middleware.error_handler import (
    app_error_handler,
    validation_error_handler,
    openai_error_handler,
    generic_exception_handler
)
from app.middleware.rate_limiter import limiter
from app.exceptions import AppError
from fastapi.exceptions import RequestValidationError
from openai import APIError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # Startup: Validate required environment variables
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable is not set")
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    logger.info("FastAPI application starting up...")
    logger.info("OpenAI API key configured")
    
    yield
    
    # Shutdown
    logger.info("FastAPI application shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Food Analysis API",
    description="API for analyzing food images and extracting nutritional information",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
# Allow all origins for mobile apps (same as Express version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set JSON request body size limit (11MB to account for base64 overhead)
# FastAPI doesn't have a direct way to set this, but uvicorn can handle it
# We'll document this in deployment instructions

# Register rate limiter state
app.state.limiter = limiter

# Register exception handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(APIError, openai_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Register rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(analyze_router)
app.include_router(images_router)


@app.get("/")
async def root():
    """
    Root endpoint
    """
    return {
        "message": "Food Analysis API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """
    Health check endpoint
    """
    return {"status": "ok"}


@app.get("/health/storage")
async def storage_health():
    """Non-secret image storage configuration diagnostics."""
    return get_storage_status()
