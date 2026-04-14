"""
Request models for API endpoints
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.models.api import IngredientItem


class AnalyzeFoodRequest(BaseModel):
    """Request model for food analysis endpoint"""
    image: Optional[str] = Field(None, min_length=1, description="Base64 encoded image string")
    description: Optional[str] = Field(None, max_length=500, description="Optional text description")
    idempotencyKey: Optional[str] = Field(
        None,
        min_length=1,
        max_length=128,
        description="Optional client-provided idempotency key for async log creation"
    )
    userId: Optional[str] = Field(None, description="Optional user identifier for future auth")

    @field_validator("image")
    @classmethod
    def validate_image_size(cls, v: str) -> str:
        """Validate approximate image size from base64 string"""
        # Remove data URL prefix if present
        image_data = v.split(",")[-1] if "," in v else v
        
        # Approximate size check: base64 is ~33% larger than binary
        # For 10MB limit, base64 would be ~13.3MB
        max_base64_size = 13 * 1024 * 1024  # ~13MB for 10MB image
        
        if len(image_data.encode("utf-8")) > max_base64_size:
            raise ValueError("Image size exceeds 10MB limit")
        
        return v

    @field_validator("description")
    @classmethod
    def validate_description_length(cls, v: Optional[str]) -> Optional[str]:
        """Validate description length"""
        if v is not None and len(v) > 500:
            raise ValueError("Description must be 500 characters or less")
        return v


class EditLogRequest(BaseModel):
    """Request model for AI-powered meal log editing"""
    ingredients: list[IngredientItem] = Field(..., min_length=1, description="Current ingredients to edit")
    correction: str = Field(..., min_length=1, max_length=500, description="Natural-language correction instruction")
