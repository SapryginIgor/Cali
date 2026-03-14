"""
Response models for API endpoints
"""

from typing import Literal, Optional
from pydantic import BaseModel
from app.models.api import NutritionResult


class AnalyzeFoodResponse(NutritionResult):
    """Response model for food analysis endpoint (extends NutritionResult)"""
    pass


class AsyncLogResponse(BaseModel):
    """Async meal log lifecycle response."""

    id: str
    status: Literal["pending", "completed", "failed"]
    description: Optional[str] = None
    createdAt: float
    updatedAt: float
    result: Optional[NutritionResult] = None
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model matching frontend interface"""
    error: str
    message: str
