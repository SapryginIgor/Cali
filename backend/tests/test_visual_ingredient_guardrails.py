import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.models.api import ClassificationResult, IngredientItem, NutritionResult
from app.services import prompts
from app.services.openai import (
    _filter_unsupported_ingredients,
    _remove_ungrounded_nutrition_ingredients,
    _reconcile_nutrition_totals,
    _remove_inferred_image_ingredients,
    _remove_unmentioned_high_risk_bowl_toppings,
    _visible_ingredients_to_grounded_json,
)


def _result_with_phantom_toppings() -> NutritionResult:
    return NutritionResult(
        carbs=41,
        protein=25,
        fats=10,
        calories=354,
        analysis="Strawberry yogurt bowl.",
        logName="Strawberry Yogurt Bowl",
        confidence=0.88,
        foodCategory="complex_meal",
        ingredients=[
            IngredientItem(
                id="yogurt",
                name="Plain Greek yogurt",
                quantity="200",
                unit="gram",
                carbs=7,
                fats=4,
                proteins=20,
                calories=140,
                evidence="visible",
            ),
            IngredientItem(
                id="strawberries",
                name="Strawberries",
                quantity="180",
                unit="gram",
                carbs=14,
                fats=1,
                proteins=1,
                calories=58,
                evidence="visible",
            ),
            IngredientItem(
                id="granola",
                name="Granola",
                quantity="30",
                unit="gram",
                carbs=20,
                fats=5,
                proteins=3,
                calories=156,
                evidence="inferred",
            ),
        ],
    )


def test_image_analysis_removes_inferred_ingredients():
    classification = ClassificationResult(category="complex_meal", hints={})
    result = _remove_inferred_image_ingredients(_result_with_phantom_toppings(), classification)

    assert [ingredient.name for ingredient in result.ingredients] == [
        "Plain Greek yogurt",
        "Strawberries",
    ]
    assert "Granola" in result.analysis
    assert result.confidence == 0.65


def test_visual_audit_filter_removes_named_unsupported_ingredient_and_reconciles_totals():
    result = _filter_unsupported_ingredients(
        _result_with_phantom_toppings(),
        unsupported_ids=set(),
        unsupported_names={"granola"},
    )
    result = _reconcile_nutrition_totals(result)

    assert [ingredient.id for ingredient in result.ingredients] == ["yogurt", "strawberries"]
    assert result.carbs == 21
    assert result.protein == 21
    assert result.fats == 5
    assert result.calories == 198


def test_bowl_guardrail_removes_unmentioned_granola_even_when_marked_visible():
    classification = ClassificationResult(category="complex_meal", hints={})
    result = _result_with_phantom_toppings()
    result.ingredients[-1].evidence = "visible"

    result = _remove_unmentioned_high_risk_bowl_toppings(result, classification, description=None)
    result = _reconcile_nutrition_totals(result)

    assert [ingredient.id for ingredient in result.ingredients] == ["yogurt", "strawberries"]
    assert "Granola" in result.analysis
    assert result.confidence == 0.6
    assert result.calories == 198


def test_bowl_guardrail_keeps_granola_when_user_named_it():
    classification = ClassificationResult(category="complex_meal", hints={})
    result = _result_with_phantom_toppings()
    result.ingredients[-1].evidence = "visible"

    result = _remove_unmentioned_high_risk_bowl_toppings(
        result,
        classification,
        description="Greek yogurt with strawberries and granola",
    )

    assert [ingredient.id for ingredient in result.ingredients] == [
        "yogurt",
        "strawberries",
        "granola",
    ]


def test_grounded_nutrition_prompt_requires_preserving_visible_ids():
    grounded_json = _visible_ingredients_to_grounded_json(_result_with_phantom_toppings().ingredients[:2])
    prompt = prompts.build_grounded_nutrition_prompt(grounded_json, "complex_meal")

    assert "preserve the exact `id`" in prompt.lower()
    assert "visible-0" not in prompt
    assert "yogurt" in prompt.lower()


def test_ungrounded_nutrition_ingredients_are_removed():
    grounded = _result_with_phantom_toppings().ingredients[:2]
    result = _result_with_phantom_toppings()
    result.ingredients[-1].id = "new-granola"
    result.ingredients[-1].evidence = "visible"

    result = _remove_ungrounded_nutrition_ingredients(result, grounded)
    result = _reconcile_nutrition_totals(result)

    assert [ingredient.id for ingredient in result.ingredients] == ["yogurt", "strawberries"]
    assert "Granola" in result.analysis
    assert result.calories == 198


def test_complex_meal_prompt_bans_unseen_bowl_toppings():
    prompt = prompts.build_complex_meal_prompt()

    assert "do not add banana, granola" in prompt.lower()
    assert "unless they are actually visible or named by the user" in prompt.lower()
