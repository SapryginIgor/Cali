"""
Request models for API endpoints
"""

from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator

from app.models.api import (
    ChatMessage,
    FoodLogContextEntry,
    IngredientItem,
    NutritionGoals,
    NutritionProfile,
    NutritionTotals,
)


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
    nutritionProfile: Optional[NutritionProfile] = Field(
        None,
        description="Optional compact coach memory for personalized analysis comments",
    )

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
    sourceUrl: Optional[str] = Field(
        None,
        min_length=1,
        max_length=2048,
        description="Optional recipe/product URL to use as the primary nutrition source",
    )
    image: Optional[str] = Field(
        None,
        min_length=1,
        description="Optional base64 image to re-check visible items during edit",
    )

    @field_validator("image")
    @classmethod
    def validate_optional_image_size(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v

        image_data = v.split(",")[-1] if "," in v else v
        max_base64_size = 13 * 1024 * 1024  # ~13MB for 10MB image
        if len(image_data.encode("utf-8")) > max_base64_size:
            raise ValueError("Image size exceeds 10MB limit")
        return v

    @field_validator("sourceUrl")
    @classmethod
    def validate_source_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v

        source_url = v.strip()
        if not source_url:
            return None

        parsed = urlparse(source_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("sourceUrl must be a valid http(s) URL")

        return source_url


class NutritionistChatRequest(BaseModel):
    """Request model for the AI nutritionist chat endpoint"""

    messages: list[ChatMessage] = Field(
        ...,
        min_length=1,
        max_length=30,
        description="Recent chat messages in chronological order",
    )
    todayTotals: Optional[NutritionTotals] = Field(
        None,
        description="Current selected day's nutrition totals",
    )
    goals: NutritionGoals = Field(
        default_factory=NutritionGoals,
        description="Optional user goals; unset values may be '-'",
    )
    nutritionProfile: NutritionProfile = Field(
        default_factory=NutritionProfile,
        description="Compact coach memory; durable facts only, not raw chat history",
    )
    recentMeals: list[FoodLogContextEntry] = Field(
        default_factory=list,
        max_length=20,
        description="Recent logged meals to ground nutrition advice",
    )

    @field_validator("messages")
    @classmethod
    def validate_chat_has_user_message(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if not any(message.role == "user" and message.content.strip() for message in v):
            raise ValueError("At least one user message is required")
        return v
