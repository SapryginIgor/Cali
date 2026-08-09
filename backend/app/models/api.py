"""
Pydantic models matching frontend interfaces
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

FoodCategory = Literal[
    "nutrition_label",
    "packaged_product",
    "simple_food",
    "complex_meal",
    "beverage",
    "text_only",
]

VALID_FOOD_CATEGORIES: set[str] = {
    "nutrition_label",
    "packaged_product",
    "simple_food",
    "complex_meal",
    "beverage",
    "text_only",
}


class ClassificationResult(BaseModel):
    """Result of the food image classification step."""

    category: FoodCategory = Field(..., description="Classified food category")
    hints: dict = Field(
        default_factory=dict,
        description="Category-specific hints (brand, productName, itemCount, hasLabel)",
    )


class IngredientItem(BaseModel):
    """Structured ingredient item with editable per-ingredient macros"""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    quantity: str = Field(..., min_length=1)
    carbs: float = Field(..., ge=0, description="Ingredient carbohydrates in grams")
    fats: float = Field(..., ge=0, description="Ingredient fats in grams")
    proteins: float = Field(..., ge=0, description="Ingredient proteins in grams")
    calories: Optional[float] = Field(
        None,
        ge=0,
        description="Ingredient calories (kcal) for this specific product/component",
    )
    evidence: Optional[Literal["visible", "user_text", "inferred"]] = Field(
        None,
        description="Why this ingredient is included: visible in image, named by user, or inferred",
    )
    sources: Optional[list[str]] = Field(
        None,
        description="Optional data source domains/labels used for this ingredient",
    )
    unit: Optional[str] = Field(None, description="Optional ingredient unit")
    preparation: Optional[str] = Field(None, description="Optional preparation note")
    note: Optional[str] = Field(None, description="Optional ingredient note")


class NutritionResult(BaseModel):
    """Nutrition analysis result matching frontend interface"""

    carbs: float = Field(..., description="Carbohydrates in grams")
    protein: float = Field(..., description="Protein in grams")
    fats: float = Field(..., description="Fats in grams")
    calories: float = Field(..., description="Total calories")
    analysis: str = Field(..., description="Brief analysis of the food")
    logName: str = Field(..., min_length=1, description="AI suggested meal log name")
    ingredients: list[IngredientItem] = Field(..., min_length=1, description="Structured ingredients")
    mealNotes: Optional[str] = Field(None, description="Optional short notes about the meal")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Analysis confidence score")
    foodCategory: Optional[str] = Field(None, description="Classified food category")
    productImageUrl: Optional[str] = Field(
        None,
        description="Optional verified product image URL for packaged products",
    )


class NutritionTotals(BaseModel):
    """Macro totals for a day or selected set of logs."""

    carbs: float = Field(..., ge=0)
    protein: float = Field(..., ge=0)
    fats: float = Field(..., ge=0)
    calories: float = Field(..., ge=0)


class FoodLogContextEntry(BaseModel):
    """Compact meal log context for nutritionist chat."""

    timestamp: float
    description: str = Field(..., min_length=1)
    nutrition: NutritionTotals
    ingredients: list[str] = Field(default_factory=list, max_length=20)
    mealNotes: Optional[str] = None


class NutritionGoals(BaseModel):
    """Optional user goals used to personalize nutritionist chat."""

    goal: str = Field("-", min_length=1, max_length=200)
    targetCalories: str = Field("-", min_length=1, max_length=80)
    targetProtein: str = Field("-", min_length=1, max_length=80)
    dietaryPreference: str = Field("-", min_length=1, max_length=200)
    allergies: str = Field("-", min_length=1, max_length=200)
    activity: str = Field("-", min_length=1, max_length=200)
    notes: str = Field("-", min_length=1, max_length=500)

    @field_validator(
        "goal",
        "targetCalories",
        "targetProtein",
        "dietaryPreference",
        "allergies",
        "activity",
        "notes",
        mode="before",
    )
    @classmethod
    def normalize_unset_goal(cls, value: object) -> str:
        if value is None:
            return "-"
        if isinstance(value, str):
            return value.strip() or "-"
        return str(value).strip() or "-"


class ChatMessage(BaseModel):
    """A single nutritionist chat message."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class NutritionistChatResult(BaseModel):
    """AI nutritionist chat response."""

    message: str = Field(..., min_length=1)
