"""
Response models for API endpoints
"""

from pydantic import BaseModel
from app.models.api import NutritionResult


class AnalyzeFoodResponse(NutritionResult):
    """Response model for food analysis endpoint (extends NutritionResult)"""
    pass


class ErrorResponse(BaseModel):
    """Error response model matching frontend interface"""
    error: str
    message: str
