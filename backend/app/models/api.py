"""
Pydantic models matching frontend interfaces
"""

from pydantic import BaseModel, Field


class NutritionResult(BaseModel):
    """Nutrition analysis result matching frontend interface"""
    carbs: float = Field(..., description="Carbohydrates in grams")
    protein: float = Field(..., description="Protein in grams")
    fats: float = Field(..., description="Fats in grams")
    calories: float = Field(..., description="Total calories")
    analysis: str = Field(..., description="Brief analysis of the food")
