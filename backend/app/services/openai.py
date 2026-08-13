"""
OpenAI service for food image analysis.
Two-step classify-then-analyze pipeline using GPT-5.6 vision models.
"""

import asyncio
import json
import logging
import os
import re
import time
from html import unescape
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from typing import Any, Optional

from openai import APIError, APITimeoutError

from app.models.api import (
    ChatMessage,
    ClassificationResult,
    FoodLogContextEntry,
    IngredientItem,
    NutritionGoals,
    NutritionProfile,
    NutritionistChatResult,
    NutritionTotals,
    NutritionResult,
    VALID_FOOD_CATEGORIES,
)
from app.exceptions import AppError
from app.services.prompts import (
    CLASSIFICATION_PROMPT,
    build_edit_log_prompt,
    build_grounded_nutrition_prompt,
    get_analysis_prompt,
)
from app.services._openai_client import get_openai_client

logger = logging.getLogger(__name__)

CLASSIFICATION_MODEL = os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-5.6-luna")
ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-5.6-luna")
PACKAGED_PRODUCT_MODEL = os.getenv("OPENAI_PACKAGED_PRODUCT_MODEL", "gpt-5.6-terra")
EDIT_MODEL = os.getenv("OPENAI_EDIT_MODEL", "gpt-5.6-luna")
VISIBLE_EXTRACTION_MODEL = os.getenv("OPENAI_VISIBLE_EXTRACTION_MODEL", "gpt-4.1")
NUTRITIONIST_CHAT_MODEL = os.getenv("OPENAI_NUTRITIONIST_CHAT_MODEL", "gpt-5.6-luna")

CLASSIFICATION_REASONING_EFFORT = os.getenv("OPENAI_CLASSIFICATION_REASONING_EFFORT", "none")
ANALYSIS_REASONING_EFFORT = os.getenv("OPENAI_ANALYSIS_REASONING_EFFORT", "low")
PACKAGED_PRODUCT_REASONING_EFFORT = os.getenv("OPENAI_PACKAGED_PRODUCT_REASONING_EFFORT", "medium")
EDIT_REASONING_EFFORT = os.getenv("OPENAI_EDIT_REASONING_EFFORT", "low")
NUTRITIONIST_CHAT_REASONING_EFFORT = os.getenv("OPENAI_NUTRITIONIST_CHAT_REASONING_EFFORT", "low")

INGREDIENT_ITEM_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "quantity": {"type": "string"},
        "carbs": {"type": "number", "minimum": 0},
        "fats": {"type": "number", "minimum": 0},
        "proteins": {"type": "number", "minimum": 0},
        "calories": {"type": "number", "minimum": 0},
        "evidence": {"type": "string", "enum": ["visible", "user_text", "inferred"]},
        "sources": {"anyOf": [{"type": "array", "items": {"type": "string"}}, {"type": "null"}]},
        "unit": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "preparation": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "note": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": [
        "id",
        "name",
        "quantity",
        "carbs",
        "fats",
        "proteins",
        "calories",
        "evidence",
        "sources",
        "unit",
        "preparation",
        "note",
    ],
}

NUTRITION_RESULT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "carbs": {"type": "number", "minimum": 0},
        "protein": {"type": "number", "minimum": 0},
        "fats": {"type": "number", "minimum": 0},
        "calories": {"type": "number", "minimum": 0},
        "analysis": {"type": "string"},
        "logName": {"type": "string"},
        "ingredients": {"type": "array", "items": INGREDIENT_ITEM_JSON_SCHEMA, "minItems": 1},
        "mealNotes": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "foodCategory": {"type": "string"},
        "productImageUrl": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": [
        "carbs",
        "protein",
        "fats",
        "calories",
        "analysis",
        "logName",
        "ingredients",
        "mealNotes",
        "confidence",
        "foodCategory",
        "productImageUrl",
    ],
}

NUTRITION_GOALS_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "goal": {"type": "string"},
        "targetCalories": {"type": "string"},
        "targetProtein": {"type": "string"},
        "dietaryPreference": {"type": "string"},
        "allergies": {"type": "string"},
        "activity": {"type": "string"},
        "notes": {"type": "string"},
    },
    "required": [
        "goal",
        "targetCalories",
        "targetProtein",
        "dietaryPreference",
        "allergies",
        "activity",
        "notes",
    ],
}

BEHAVIOR_PATTERN_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "id": {"type": "string"},
        "label": {"type": "string"},
        "trigger": {"type": "string"},
        "context": {"type": "string"},
        "goalRelevance": {"type": "string"},
        "tone": {"type": "string"},
        "active": {"type": "boolean"},
    },
    "required": [
        "id",
        "label",
        "trigger",
        "context",
        "goalRelevance",
        "tone",
        "active",
    ],
}

NUTRITION_PROFILE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "behaviorPatterns": {
            "type": "array",
            "items": BEHAVIOR_PATTERN_JSON_SCHEMA,
        },
        "dislikedAdvice": {"type": "string"},
        "tonePreference": {"type": "string"},
        "openQuestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "summary",
        "behaviorPatterns",
        "dislikedAdvice",
        "tonePreference",
        "openQuestions",
    ],
}

NUTRITIONIST_CHAT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "message": {"type": "string"},
        "goalUpdates": {
            "anyOf": [
                NUTRITION_GOALS_JSON_SCHEMA,
                {"type": "null"},
            ]
        },
        "profileUpdates": {
            "anyOf": [
                NUTRITION_PROFILE_JSON_SCHEMA,
                {"type": "null"},
            ]
        },
    },
    "required": ["message", "goalUpdates", "profileUpdates"],
}

CLASSIFICATION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "category": {"type": "string", "enum": list(VALID_FOOD_CATEGORIES)},
        "hints": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "brand": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "productName": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "itemCount": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "hasLabel": {"anyOf": [{"type": "boolean"}, {"type": "null"}]},
            },
            "required": ["brand", "productName", "itemCount", "hasLabel"],
        },
    },
    "required": ["category", "hints"],
}

VISUAL_AUDIT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "unsupportedIngredientIds": {"type": "array", "items": {"type": "string"}},
        "unsupportedIngredientNames": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"},
    },
    "required": ["unsupportedIngredientIds", "unsupportedIngredientNames", "notes"],
}

VISIBLE_INGREDIENT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "logName": {"type": "string"},
        "visibleIngredients": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "evidence": {"type": "string"},
                    "certainty": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["name", "evidence", "certainty"],
            },
        },
        "uncertainVisibleItems": {"type": "array", "items": {"type": "string"}},
        "rejectedCommonButUnseenItems": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"},
    },
    "required": [
        "logName",
        "visibleIngredients",
        "uncertainVisibleItems",
        "rejectedCommonButUnseenItems",
        "notes",
    ],
}


def _is_placeholder_text(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {"-", "—", "_", "n/a", "na", "none", "unknown", "null"}


def _responses_max_output_tokens(visible_budget: int) -> int:
    """Responses max output includes reasoning tokens, so leave room above visible JSON."""
    return max(visible_budget * 2, visible_budget + 1000)


def _responses_input_content(
    prompt_text: str,
    image_data: Optional[str] = None,
    image_detail: Optional[str] = None,
) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "input_text", "text": prompt_text}]
    if image_data:
        content.append(
            {
                "type": "input_image",
                "image_url": f"data:image/jpeg;base64,{image_data}",
                "detail": image_detail or "auto",
            }
        )
    return content


async def _create_json_response(
    client: Any,
    *,
    model: str,
    prompt_text: str,
    image_data: Optional[str] = None,
    image_detail: Optional[str] = None,
    max_output_tokens: int,
    reasoning_effort: str,
    tools: Optional[list[dict[str, Any]]] = None,
    include: Optional[list[str]] = None,
    json_mode: bool = True,
    response_schema: Optional[dict[str, Any]] = None,
) -> Any:
    params: dict[str, Any] = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": _responses_input_content(prompt_text, image_data, image_detail),
            }
        ],
        "max_output_tokens": max_output_tokens,
    }
    if not model.startswith("gpt-4.1"):
        params["reasoning"] = {"effort": reasoning_effort}
    if response_schema:
        params["text"] = {
            "format": {
                "type": "json_schema",
                "name": "response",
                "schema": response_schema,
                "strict": True,
            }
        }
        if not model.startswith("gpt-4.1"):
            params["text"]["verbosity"] = "low"
    elif json_mode:
        params["text"] = {"format": {"type": "json_object"}}
        if not model.startswith("gpt-4.1"):
            params["text"]["verbosity"] = "low"
    if tools:
        params["tools"] = tools
    if include:
        params["include"] = include
    return await client.responses.create(**params)


async def classify_food_image(
    image_base64: Optional[str] = None,
    description: Optional[str] = None,
) -> ClassificationResult:
    """Classify a food image into one of the six food categories.

    Uses a low-detail, low-token GPT-4.1-mini call for efficiency.
    Falls back to ``complex_meal`` on any failure.
    """
    if not image_base64 and not description:
        logger.info("[classify] No image or description provided → text_only")
        return ClassificationResult(category="text_only", hints={})

    try:
        client = get_openai_client()

        image_data = image_base64 or ""
        if image_data and "," in image_data:
            image_data = image_base64.split(",")[1]

        prompt_text = CLASSIFICATION_PROMPT
        if description:
            prompt_text += f"\nUser description: {description}\n"

        logger.info(
            "[classify] Sending classification request (model=%s, reasoning=%s, image=%s, description=%s)",
            CLASSIFICATION_MODEL,
            CLASSIFICATION_REASONING_EFFORT,
            "yes" if image_data else "no",
            "yes" if description else "no",
        )
        t0 = time.monotonic()

        response = await _create_json_response(
            client,
            model=CLASSIFICATION_MODEL,
            prompt_text=prompt_text,
            image_data=image_data or None,
            image_detail="low" if image_data else None,
            max_output_tokens=500,
            reasoning_effort=CLASSIFICATION_REASONING_EFFORT,
            response_schema=CLASSIFICATION_JSON_SCHEMA,
        )

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        content = response.output_text
        usage = response.usage

        logger.info(
            "[classify] Response received in %dms | tokens: input=%s output=%s",
            elapsed_ms,
            usage.input_tokens if usage else "?",
            usage.output_tokens if usage else "?",
        )
        logger.info("[classify] Raw response: %s", content)

        if not content:
            logger.warning("[classify] Empty response → fallback to complex_meal")
            return ClassificationResult(category="complex_meal", hints={})

        parsed = json.loads(content)
        raw_category = parsed.get("category", "")
        category = raw_category if raw_category in VALID_FOOD_CATEGORIES else "complex_meal"

        if raw_category != category:
            logger.warning(
                "[classify] Unrecognised category %r → remapped to complex_meal",
                raw_category,
            )

        hints = parsed.get("hints", {})
        if not isinstance(hints, dict):
            hints = {}

        logger.info("[classify] Result: category=%s hints=%s", category, hints)
        return ClassificationResult(category=category, hints=hints)

    except Exception as exc:
        logger.error("[classify] Classification failed, falling back to complex_meal: %s", exc)
        return ClassificationResult(category="complex_meal", hints={})


def _compute_heuristic_confidence(
    result: NutritionResult,
    classification: ClassificationResult,
) -> float:
    """Adjust the model-reported confidence using heuristic cross-checks."""
    model_confidence = result.confidence if result.confidence is not None else 0.7
    logger.info("[confidence] Model-reported confidence: %s", model_confidence)

    adjusted = model_confidence

    if result.ingredients:
        ing_carbs = sum(i.carbs for i in result.ingredients)
        ing_fats = sum(i.fats for i in result.ingredients)
        ing_proteins = sum(i.proteins for i in result.ingredients)

        logger.info(
            "[confidence] Macro cross-check — reported: carbs=%.1f fats=%.1f protein=%.1f | "
            "ingredient sums: carbs=%.1f fats=%.1f protein=%.1f",
            result.carbs, result.fats, result.protein,
            ing_carbs, ing_fats, ing_proteins,
        )

        for macro_name, reported, summed in [
            ("carbs", result.carbs, ing_carbs),
            ("fats", result.fats, ing_fats),
            ("protein", result.protein, ing_proteins),
        ]:
            if reported > 0 and abs(reported - summed) / reported > 0.20:
                divergence = abs(reported - summed) / reported * 100
                logger.warning(
                    "[confidence] %s diverges %.0f%% (reported=%.1f vs sum=%.1f) → -0.2",
                    macro_name, divergence, reported, summed,
                )
                adjusted -= 0.2
                break

    if classification.category == "packaged_product":
        analysis_lower = (result.analysis or "").lower()
        if any(
            phrase in analysis_lower
            for phrase in ["uncertain", "could not identify", "unable to identify", "not sure", "unknown product"]
        ):
            logger.warning("[confidence] Unidentified packaged product detected in analysis text → -0.3")
            adjusted -= 0.3

    final = max(0.0, min(1.0, adjusted))
    logger.info("[confidence] Final confidence: %.2f (model=%.2f, adjusted by %.2f)", final, model_confidence, final - model_confidence)
    return final


def _get_item_count_hint(classification: ClassificationResult) -> Optional[int]:
    """Get a normalized item-count hint from classifier metadata."""
    raw = classification.hints.get("itemCount")
    if isinstance(raw, (int, float)) and raw > 0:
        return int(raw)
    return None


def _visible_ingredients_to_grounded_json(ingredients: list[IngredientItem]) -> str:
    return json.dumps(
        [
            {
                "id": ingredient.id,
                "name": ingredient.name,
                "evidence": ingredient.evidence or "visible",
                "note": ingredient.note,
            }
            for ingredient in ingredients
        ],
        ensure_ascii=False,
    )


async def _extract_visible_ingredients(
    client: Any,
    image_data: str,
    description: Optional[str] = None,
) -> tuple[str, list[IngredientItem], str]:
    """Use GPT-4.1 as a literal image-only visible ingredient extractor."""
    prompt_text = (
        "Identify ONLY food ingredients that are directly visible in this image. "
        "Do not estimate nutrition. Do not infer recipe ingredients. Do not add common toppings "
        "or likely ingredients unless you can point to visible image evidence. In particular, "
        "banana, granola, muesli, nuts, seeds, honey, and syrup must be rejected unless they are "
        "clearly visible. If a white dairy component is ambiguous, use visual names such as "
        "'white creamy dairy' or 'white curd-like dairy' instead of forcing a specific identity. "
        "Return JSON only."
    )
    if description:
        prompt_text += (
            "\nUser text may clarify ambiguous visible items, but it must not make you add "
            f"items that are not visible: {description}"
        )

    logger.info("[visible] Extracting visible ingredients (model=%s)", VISIBLE_EXTRACTION_MODEL)
    t0 = time.monotonic()
    response = await _create_json_response(
        client,
        model=VISIBLE_EXTRACTION_MODEL,
        prompt_text=prompt_text,
        image_data=image_data,
        image_detail="high",
        max_output_tokens=900,
        reasoning_effort="none",
        response_schema=VISIBLE_INGREDIENT_JSON_SCHEMA,
    )
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    content = response.output_text
    logger.info("[visible] Response received in %dms: %s", elapsed_ms, content)
    if not content:
        raise AppError(500, "No visible ingredient response from AI service")

    parsed = json.loads(content)
    raw_ingredients = parsed.get("visibleIngredients", [])
    if not isinstance(raw_ingredients, list):
        raw_ingredients = []

    ingredients: list[IngredientItem] = []
    for index, item in enumerate(raw_ingredients):
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip() or _is_placeholder_text(name):
            continue
        evidence_text = item.get("evidence")
        certainty = item.get("certainty")
        note_parts = []
        if isinstance(evidence_text, str) and evidence_text.strip():
            note_parts.append(evidence_text.strip())
        if isinstance(certainty, (int, float)):
            note_parts.append(f"visual certainty {float(certainty):.2f}")
        ingredients.append(
            IngredientItem(
                id=f"visible-{index}",
                name=name.strip(),
                quantity="1",
                unit="serving",
                carbs=0,
                fats=0,
                proteins=0,
                calories=0,
                evidence="visible",
                note="; ".join(note_parts) if note_parts else None,
            )
        )

    notes = parsed.get("notes")
    if not ingredients:
        raise AppError(422, "No visually supported food ingredients were found")
    return (
        parsed.get("logName", "Meal") if isinstance(parsed.get("logName"), str) else "Meal",
        ingredients,
        notes if isinstance(notes, str) else "",
    )


def _reconcile_nutrition_totals(
    result: NutritionResult,
    prefer_reported_calories: bool = False,
) -> NutritionResult:
    """Derive macros from ingredients and optionally preserve reported calories.

    - Macros (`carbs`, `fats`, `protein`) are always derived from final ingredients.
    - Calories are derived from per-ingredient calories so total is transparent.
    - `prefer_reported_calories` is kept for compatibility and only affects logging.
    """
    if not result.ingredients:
        return result

    ing_carbs = sum(i.carbs for i in result.ingredients)
    ing_fats = sum(i.fats for i in result.ingredients)
    ing_proteins = sum(i.proteins for i in result.ingredients)
    ingredient_calories_sum = sum(
        (
            float(i.calories)
            if isinstance(i.calories, (int, float)) and i.calories >= 0
            else (i.carbs * 4 + i.proteins * 4 + i.fats * 9)
        )
        for i in result.ingredients
    )
    derived_calories = ingredient_calories_sum

    reported_calories = result.calories
    had_difference = (
        abs(result.carbs - ing_carbs) > 0.01
        or abs(result.fats - ing_fats) > 0.01
        or abs(result.protein - ing_proteins) > 0.01
        or abs(reported_calories - derived_calories) > 0.5
    )

    if had_difference:
        logger.warning(
            "[normalize] Overriding top-level totals from ingredients. "
            "reported(c=%.1f,f=%.1f,p=%.1f,kcal=%.1f) -> "
            "ingredients(c=%.1f,f=%.1f,p=%.1f,kcal=%.1f)",
            result.carbs, result.fats, result.protein, result.calories,
            ing_carbs, ing_fats, ing_proteins, derived_calories,
        )
    else:
        logger.info("[normalize] Totals already consistent with ingredient list")

    result.carbs = round(ing_carbs, 1)
    result.fats = round(ing_fats, 1)
    result.protein = round(ing_proteins, 1)
    if prefer_reported_calories and isinstance(reported_calories, (int, float)) and reported_calories > 0:
        logger.info(
            "[normalize] Source-reported total calories=%.1f; final total uses ingredient sum=%.1f",
            reported_calories,
            derived_calories,
        )
    result.calories = round(derived_calories)

    return result


def _remove_inferred_image_ingredients(
    result: NutritionResult,
    classification: ClassificationResult,
) -> NutritionResult:
    """Drop model-inferred ingredients from image-based analyses.

    Inferred ingredients are useful for text-only assumptions, but in image
    flows they are the exact failure mode that creates phantom toppings.
    """
    if classification.category == "text_only" or not result.ingredients:
        return result

    kept: list[IngredientItem] = []
    removed: list[str] = []
    for ingredient in result.ingredients:
        if ingredient.evidence == "inferred":
            removed.append(ingredient.name)
            continue
        kept.append(ingredient)

    if not removed:
        return result

    result.ingredients = kept
    removal_note = f"Removed unsupported inferred ingredients: {', '.join(removed)}."
    result.analysis = (
        f"{result.analysis.strip()} {removal_note}"
        if result.analysis and result.analysis.strip()
        else removal_note
    )
    result.confidence = min(result.confidence or 0.7, 0.65)
    logger.warning("[guardrail] Removed inferred image ingredients: %s", removed)
    return result


def _apply_evidence_defaults(
    result: NutritionResult,
    classification: ClassificationResult,
) -> NutritionResult:
    default_evidence = "user_text" if classification.category == "text_only" else "visible"
    for ingredient in result.ingredients:
        if ingredient.evidence not in {"visible", "user_text", "inferred"}:
            ingredient.evidence = default_evidence
    return result


HIGH_RISK_BOWL_TOPPING_KEYWORDS = {
    "banana",
    "granola",
    "muesli",
    "nut",
    "nuts",
    "almond",
    "almonds",
    "walnut",
    "walnuts",
    "pecan",
    "pecans",
    "seed",
    "seeds",
    "chia",
    "flax",
    "hemp",
    "honey",
    "syrup",
    "maple",
}

BOWL_CONTEXT_KEYWORDS = {
    "bowl",
    "yogurt",
    "yoghurt",
    "oatmeal",
    "porridge",
    "cottage cheese",
    "curd",
    "quark",
    "strawberries",
    "strawberry",
    "berries",
}


def _text_mentions_food(text: Optional[str], food_name: str) -> bool:
    if not text:
        return False
    normalized_text = text.lower()
    normalized_food = food_name.lower()
    return any(part in normalized_text for part in normalized_food.replace("-", " ").split())


def _has_bowl_context(result: NutritionResult) -> bool:
    context = " ".join(
        [
            result.logName or "",
            result.analysis or "",
            " ".join(ingredient.name for ingredient in result.ingredients),
        ]
    ).lower()
    return any(keyword in context for keyword in BOWL_CONTEXT_KEYWORDS)


def _is_high_risk_bowl_topping(name: str) -> bool:
    normalized_name = name.lower()
    return any(keyword in normalized_name for keyword in HIGH_RISK_BOWL_TOPPING_KEYWORDS)


def _remove_unmentioned_high_risk_bowl_toppings(
    result: NutritionResult,
    classification: ClassificationResult,
    description: Optional[str],
) -> NutritionResult:
    """Deterministically remove common hallucinated bowl toppings.

    This is intentionally stricter than the model audit. If the user did not
    name a high-risk topping, image-only bowl analyses must not invent it.
    """
    if classification.category == "text_only" or not result.ingredients or not _has_bowl_context(result):
        return result

    kept: list[IngredientItem] = []
    removed: list[str] = []
    for ingredient in result.ingredients:
        if _is_high_risk_bowl_topping(ingredient.name) and not _text_mentions_food(description, ingredient.name):
            removed.append(ingredient.name)
            continue
        kept.append(ingredient)

    if not removed:
        return result

    result.ingredients = kept
    removal_note = f"Removed unconfirmed common bowl toppings: {', '.join(removed)}."
    result.analysis = (
        f"{result.analysis.strip()} {removal_note}"
        if result.analysis and result.analysis.strip()
        else removal_note
    )
    result.confidence = min(result.confidence or 0.7, 0.6)
    logger.warning("[guardrail] Removed unmentioned high-risk bowl toppings: %s", removed)
    return result


def _remove_ungrounded_nutrition_ingredients(
    result: NutritionResult,
    grounded_ingredients: list[IngredientItem],
) -> NutritionResult:
    """Keep nutrition output aligned to the visible extraction pass."""
    if not grounded_ingredients or not result.ingredients:
        return result

    grounded_ids = {ingredient.id for ingredient in grounded_ingredients}
    kept: list[IngredientItem] = []
    removed: list[str] = []
    for ingredient in result.ingredients:
        if ingredient.id not in grounded_ids:
            removed.append(ingredient.name)
            continue
        kept.append(ingredient)

    if not removed:
        return result

    result.ingredients = kept
    removal_note = f"Removed ingredients not produced by visible extraction: {', '.join(removed)}."
    result.analysis = (
        f"{result.analysis.strip()} {removal_note}"
        if result.analysis and result.analysis.strip()
        else removal_note
    )
    result.confidence = min(result.confidence or 0.7, 0.65)
    logger.warning("[guardrail] Removed ungrounded nutrition ingredients: %s", removed)
    return result


def _filter_unsupported_ingredients(
    result: NutritionResult,
    unsupported_ids: set[str],
    unsupported_names: set[str],
) -> NutritionResult:
    if not result.ingredients or (not unsupported_ids and not unsupported_names):
        return result

    kept: list[IngredientItem] = []
    removed: list[str] = []
    normalized_unsupported_names = {name.strip().lower() for name in unsupported_names if name.strip()}

    for ingredient in result.ingredients:
        if ingredient.id in unsupported_ids or ingredient.name.strip().lower() in normalized_unsupported_names:
            removed.append(ingredient.name)
            continue
        kept.append(ingredient)

    if not removed:
        return result

    result.ingredients = kept
    audit_note = f"Visual audit removed unsupported ingredients: {', '.join(removed)}."
    result.analysis = (
        f"{result.analysis.strip()} {audit_note}"
        if result.analysis and result.analysis.strip()
        else audit_note
    )
    result.confidence = min(result.confidence or 0.7, 0.65)
    logger.warning("[visual_audit] Removed unsupported ingredients: %s", removed)
    return result


async def _audit_visual_ingredient_support(
    client: Any,
    image_data: str,
    result: NutritionResult,
    classification: ClassificationResult,
) -> NutritionResult:
    """Ask a vision model to remove listed ingredients that are not supported by the image."""
    if classification.category == "text_only" or not image_data or not result.ingredients:
        return result

    ingredients_json = json.dumps(
        [
            {
                "id": ingredient.id,
                "name": ingredient.name,
                "quantity": ingredient.quantity,
                "evidence": ingredient.evidence,
            }
            for ingredient in result.ingredients
        ],
        ensure_ascii=False,
    )
    prompt_text = (
        "You are a strict food-image ingredient auditor. Compare the image to the proposed "
        "ingredient list. Return ingredients that are NOT visually supported and NOT explicitly "
        "named by the user. Do not flag generic dairy/yogurt/cream if a white dairy component is "
        "visible, but do flag common toppings such as banana, granola, nuts, seeds, honey, syrup, "
        "or sauces when they are not clearly visible.\n\n"
        "Return ONLY JSON with this exact shape:\n"
        '{ "unsupportedIngredientIds": string[], "unsupportedIngredientNames": string[], "notes": string }\n\n'
        f"Proposed ingredients:\n{ingredients_json}"
    )

    try:
        response = await _create_json_response(
            client,
            model=ANALYSIS_MODEL,
            prompt_text=prompt_text,
            image_data=image_data,
            image_detail="low",
            max_output_tokens=600,
            reasoning_effort=ANALYSIS_REASONING_EFFORT,
            response_schema=VISUAL_AUDIT_JSON_SCHEMA,
        )
        content = response.output_text
        if not content:
            return result
        parsed = json.loads(content)
        raw_ids = parsed.get("unsupportedIngredientIds", [])
        raw_names = parsed.get("unsupportedIngredientNames", [])
        unsupported_ids = {item for item in raw_ids if isinstance(item, str)}
        unsupported_names = {item for item in raw_names if isinstance(item, str)}
        return _filter_unsupported_ingredients(result, unsupported_ids, unsupported_names)
    except Exception as exc:
        logger.warning("[visual_audit] Audit failed; keeping original ingredient list: %s", exc)
        return result


def _extract_response_text(response: Any) -> str:
    """Extract text content from a Responses API response.

    The response.output list contains ``web_search_call`` items (search
    metadata) and ``message`` items (the actual model response).  We
    iterate over the output, find the first ``output_text`` block inside
    a ``message`` item, and return its text.
    """
    for item in response.output:
        if getattr(item, "type", None) == "message":
            for block in item.content:
                if getattr(block, "type", None) == "output_text":
                    return block.text
    raise AppError(500, "No text content in Responses API response")


def _extract_source_urls(response: Any) -> list[str]:
    """Extract cited source URLs from Responses API annotations."""
    urls: list[str] = []

    def add_url(url: Any) -> None:
        if not isinstance(url, str) or not url.strip():
            return
        try:
            parsed = urlparse(url)
            if parsed.scheme in {"http", "https"} and parsed.netloc and url not in urls:
                urls.append(url)
        except Exception:
            return

    for item in getattr(response, "output", []):
        if getattr(item, "type", None) == "web_search_call":
            action = getattr(item, "action", None)
            add_url(getattr(action, "url", None))
            for source in getattr(action, "sources", None) or []:
                add_url(getattr(source, "url", None))
            continue

        if getattr(item, "type", None) != "message":
            continue
        for block in getattr(item, "content", []):
            annotations = getattr(block, "annotations", None) or []
            for annotation in annotations:
                url = (
                    getattr(annotation, "url", None)
                    or getattr(annotation, "source_url", None)
                    or (annotation.get("url") if isinstance(annotation, dict) else None)
                    or (annotation.get("source_url") if isinstance(annotation, dict) else None)
                )
                add_url(url)
    return urls


def _source_domains_from_urls(source_urls: list[str]) -> list[str]:
    """Convert cited source URLs into unique source domains."""
    domains: list[str] = []
    for url in source_urls:
        try:
            domain = urlparse(url).netloc.lower()
        except Exception:
            continue
        if domain and domain not in domains:
            domains.append(domain)
    return domains


def _set_verified_sources_on_ingredients(
    result: NutritionResult,
    source_domains: list[str],
) -> NutritionResult:
    """Replace model-written sources with domains from actual web-search citations."""
    verified_sources = source_domains[:3]

    for ingredient in result.ingredients:
        ingredient.sources = verified_sources or None
    return result


def _domain_root(domain: str) -> str:
    parts = domain.lower().split(".")
    if len(parts) < 2:
        return domain.lower()
    return ".".join(parts[-2:])


def _verified_product_image_url(
    image_url: Optional[str],
    source_domains: list[str],
) -> Optional[str]:
    """Keep product images only when they line up with verified search sources."""
    if not image_url:
        return None
    try:
        parsed = urlparse(image_url)
    except Exception:
        return None

    image_domain = parsed.netloc.lower()
    if parsed.scheme != "https" or not image_domain:
        return None

    image_root = _domain_root(image_domain)
    source_roots = {_domain_root(domain) for domain in source_domains}
    if image_root not in source_roots:
        logger.info(
            "[web_search] Dropping product image URL from unverified domain: %s",
            image_domain,
        )
        return None
    return image_url


def _extract_meta_image_url(html: str) -> Optional[str]:
    """Extract a likely product image URL from Open Graph/Twitter metadata."""
    patterns = [
        r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
        r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if match:
            return unescape(match.group(1).strip())
    return None


def _https_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    if parsed.scheme == "https" and parsed.netloc:
        return url
    return None


def _fetch_page_meta_image(source_url: str, source_domains: list[str]) -> Optional[str]:
    try:
        source_domain = urlparse(source_url).netloc.lower()
        if source_domain not in source_domains:
            return None
        request = Request(
            source_url,
            headers={
                "User-Agent": "Cali/1.0 (+https://cali.app)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return None
            html = response.read(256_000).decode("utf-8", errors="ignore")
    except Exception as exc:
        logger.info("[web_search] Could not fetch source metadata image from %s: %s", source_url, exc)
        return None

    metadata_image_url = _extract_meta_image_url(html)
    if metadata_image_url:
        metadata_image_url = urljoin(source_url, metadata_image_url)
    return _https_url(metadata_image_url)


async def _find_product_image_from_sources(
    source_urls: list[str],
    source_domains: list[str],
) -> Optional[str]:
    """Find an HTTPS product image from cited official/trusted source pages."""
    for source_url in source_urls[:5]:
        image_url = await asyncio.to_thread(_fetch_page_meta_image, source_url, source_domains)
        if image_url:
            logger.info("[web_search] Found product image from source metadata: %s", image_url)
            return image_url
    return None


def _has_web_search_calls(response: Any) -> bool:
    """Check whether the model actually invoked web search tool calls."""
    for item in getattr(response, "output", []):
        if getattr(item, "type", None) == "web_search_call":
            return True
    return False


def _extract_json_from_text(text: str) -> str:
    """Pull the JSON object out of free-text that may contain markdown fences."""
    import re

    fenced = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fenced:
        return fenced.group(1).strip()

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        return text[brace_start : brace_end + 1]

    return text.strip()


async def _analyze_with_web_search(
    client: Any,
    image_data: Optional[str],
    prompt_text: str,
) -> tuple[str, list[str], list[str]]:
    """Run analysis via the Responses API with the ``web_search`` tool.

    Used for ``packaged_product`` so the model can look up real nutrition
    data online instead of guessing. Returns raw JSON text and source domains.

    Note: web_search is incompatible with JSON mode, so we rely on the
    prompt to enforce JSON output and extract it from free text.
    """
    logger.info(
        "[web_search] Sending Responses API request with web_search tool (model=%s, reasoning=%s)…",
        PACKAGED_PRODUCT_MODEL,
        PACKAGED_PRODUCT_REASONING_EFFORT,
    )
    t0 = time.monotonic()

    response = await _create_json_response(
        client,
        model=PACKAGED_PRODUCT_MODEL,
        prompt_text=prompt_text,
        image_data=image_data,
        max_output_tokens=1800,
        reasoning_effort=PACKAGED_PRODUCT_REASONING_EFFORT,
        tools=[{"type": "web_search"}],
        include=["web_search_call.action.sources"],
        json_mode=False,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    logger.info("[web_search] Response received in %dms", elapsed_ms)

    used_search = _has_web_search_calls(response)
    source_urls = _extract_source_urls(response)
    source_domains = _source_domains_from_urls(source_urls)
    logger.info(
        "[web_search] Tool usage: web_search_calls=%s | sources=%s",
        used_search,
        source_domains if source_domains else "none",
    )
    if not used_search:
        raise AppError(500, "Web search tool was not used for packaged product analysis")

    raw_text = _extract_response_text(response)
    logger.info("[web_search] Raw text: %s", raw_text)

    json_text = _extract_json_from_text(raw_text)
    logger.info("[web_search] Extracted JSON: %s", json_text)
    return json_text, source_domains, source_urls


async def analyze_food_image(
    image_base64: Optional[str] = None,
    description: Optional[str] = None,
    nutrition_profile: Optional[NutritionProfile] = None,
) -> NutritionResult:
    """Classify and then analyse a food image with category-specific prompting."""
    pipeline_t0 = time.monotonic()
    logger.info(
        "===== [pipeline] Starting food analysis (image=%s chars, description=%s) =====",
        len(image_base64) if image_base64 else "none",
        repr(description[:80]) if description else "none",
    )

    try:
        client = get_openai_client()

        image_data = ""
        if image_base64:
            image_data = image_base64
            if "," in image_base64:
                image_data = image_base64.split(",")[1]

        # --- Step 1: Classify ---
        classification = await classify_food_image(image_base64, description)

        grounded_ingredients: list[IngredientItem] = []
        visible_notes = ""
        should_use_grounded_visible_pass = bool(image_data) and classification.category in {
            "simple_food",
            "complex_meal",
            "beverage",
        }

        # --- Step 2: Build category-specific prompt ---
        if should_use_grounded_visible_pass:
            visible_log_name, grounded_ingredients, visible_notes = await _extract_visible_ingredients(
                client,
                image_data,
                description,
            )
            grounded_json = _visible_ingredients_to_grounded_json(grounded_ingredients)
            prompt_text = build_grounded_nutrition_prompt(
                grounded_json,
                classification.category,
                description,
            )
            prompt_text += (
                f"Visible extraction suggested log name: {visible_log_name}\n"
                f"Visible extraction notes: {visible_notes}\n\n"
            )
            max_tokens = 1200
        else:
            prompt_text, max_tokens = get_analysis_prompt(
                classification.category, description, classification.hints
            )
        profile_context = _format_profile_for_analysis(nutrition_profile)
        if profile_context:
            prompt_text += (
                "\nPersonalization context from coach memory:\n"
                f"{profile_context}\n\n"
                "If the logged meal clearly matches an active behavior pattern, add one short, gentle "
                "sentence to `analysis` explaining why it matters for the user's stated goals and one "
                "practical adjustment. Do not moralize, shame, diagnose, or mention patterns that do "
                "not apply. Do not invent new profile facts.\n"
            )
        logger.info(
            "[analyze] Branch selected: category=%s | grounded_visible=%s | max_tokens=%d | prompt length=%d chars",
            classification.category,
            "yes" if grounded_ingredients else "no",
            max_tokens,
            len(prompt_text),
        )

        async def make_request(force_strict_json: bool) -> str:
            text = prompt_text
            if force_strict_json:
                text += "\nPrevious response was invalid. Respond with valid JSON only."

            request_image_data = (
                None
                if grounded_ingredients or classification.category == "text_only"
                else image_data
            )

            logger.info(
                "[analyze] Sending analysis request (model=%s, reasoning=%s, attempt=%s)...",
                ANALYSIS_MODEL,
                ANALYSIS_REASONING_EFFORT,
                "retry" if force_strict_json else "first",
            )
            t0 = time.monotonic()

            response = await _create_json_response(
                client,
                model=ANALYSIS_MODEL,
                prompt_text=text,
                image_data=request_image_data,
                max_output_tokens=_responses_max_output_tokens(max_tokens),
                reasoning_effort=ANALYSIS_REASONING_EFFORT,
                response_schema=NUTRITION_RESULT_JSON_SCHEMA,
            )

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            content = response.output_text
            usage = response.usage

            logger.info(
                "[analyze] Response received in %dms | tokens: input=%s output=%s",
                elapsed_ms,
                usage.input_tokens if usage else "?",
                usage.output_tokens if usage else "?",
            )
            logger.info("[analyze] Raw response: %s", content)

            if not content:
                raise AppError(500, "No response from AI service")
            return content

        def parse_response_content(content: str) -> dict[str, Any]:
            try:
                parsed = json.loads(content)
                if not isinstance(parsed, dict):
                    raise AppError(500, "Invalid response format from AI service")
                return parsed
            except json.JSONDecodeError:
                raise AppError(500, "Invalid response format from AI service")

        parsed_response: dict[str, Any] = {}
        result: Optional[NutritionResult] = None
        has_source_backed_calories = False

        # --- Step 3a: Packaged products → Responses API with web search ---
        if classification.category == "packaged_product":
            try:
                ws_content, source_domains, source_urls = await _analyze_with_web_search(
                    client, image_data, prompt_text
                )
                parsed_response = parse_response_content(ws_content)
                result = NutritionResult(**parsed_response)
                has_source_backed_calories = True
                logger.info("[analyze] Web search analysis succeeded")
                result = _set_verified_sources_on_ingredients(result, source_domains)
                result.productImageUrl = _verified_product_image_url(
                    result.productImageUrl,
                    source_domains,
                )
                if not result.productImageUrl:
                    result.productImageUrl = await _find_product_image_from_sources(
                        source_urls,
                        source_domains,
                    )
                if source_domains:
                    sources_note = f"Sources: {', '.join(source_domains[:3])}"
                    if result.mealNotes and result.mealNotes.strip():
                        if "sources:" not in result.mealNotes.lower():
                            result.mealNotes = f"{result.mealNotes.strip()} | {sources_note}"
                    else:
                        result.mealNotes = sources_note

                # If classifier says there are multiple visible items, but the model
                # returned only one ingredient, run a stricter second pass.
                item_count_hint = _get_item_count_hint(classification)
                if item_count_hint and item_count_hint >= 2 and len(result.ingredients) < 2:
                    logger.warning(
                        "[analyze] Potential undercount: classifier itemCount=%d but ingredients=%d. Retrying with explicit multi-item instruction.",
                        item_count_hint,
                        len(result.ingredients),
                    )
                    strict_multi_item_prompt = (
                        f"{prompt_text}\n"
                        f"Additional instruction: classifier estimated about {item_count_hint} visible packaged items. "
                        "Your output MUST account for all visible items. Include beverages if present. "
                        "For repeated identical products, use quantity like '2 x 200 ml' (or separate entries), "
                        "and ensure total macros/calories include every visible unit."
                    )
                    retry_content, retry_sources, retry_source_urls = await _analyze_with_web_search(
                        client, image_data, strict_multi_item_prompt
                    )
                    retry_parsed = parse_response_content(retry_content)
                    retry_result = NutritionResult(**retry_parsed)
                    retry_result = _set_verified_sources_on_ingredients(retry_result, retry_sources)
                    retry_result.productImageUrl = _verified_product_image_url(
                        retry_result.productImageUrl,
                        retry_sources,
                    )
                    if not retry_result.productImageUrl:
                        retry_result.productImageUrl = await _find_product_image_from_sources(
                            retry_source_urls,
                            retry_sources,
                        )
                    if retry_sources:
                        retry_sources_note = f"Sources: {', '.join(retry_sources[:3])}"
                        if retry_result.mealNotes and retry_result.mealNotes.strip():
                            if "sources:" not in retry_result.mealNotes.lower():
                                retry_result.mealNotes = (
                                    f"{retry_result.mealNotes.strip()} | {retry_sources_note}"
                                )
                        else:
                            retry_result.mealNotes = retry_sources_note
                    if len(retry_result.ingredients) >= len(result.ingredients):
                        result = retry_result
                        parsed_response = retry_parsed
                        logger.info("[analyze] Multi-item retry produced improved ingredient list")
            except Exception as ws_err:
                logger.warning(
                    "[analyze] Web search path failed (%s), falling back to Chat Completions",
                    ws_err,
                )
                result = None

        # --- Step 3b: Regular Chat Completions (all others, or ws fallback) ---
        if result is None:
            for attempt in range(2):
                content = await make_request(attempt > 0)
                parsed_response = parse_response_content(content)
                try:
                    result = NutritionResult(**parsed_response)
                    result = _set_verified_sources_on_ingredients(result, [])
                    logger.info("[analyze] Validation passed on attempt %d", attempt + 1)
                    break
                except Exception as validation_error:
                    logger.warning(
                        "[analyze] Validation failed (attempt %d): %s",
                        attempt + 1, validation_error,
                    )

        if result is None:
            logger.warning("[analyze] All attempts failed validation → using normalize_fallback")
            result = normalize_fallback(parsed_response, description)
            result = _set_verified_sources_on_ingredients(result, [])

        if grounded_ingredients and not result.ingredients:
            result.ingredients = grounded_ingredients

        if not result.analysis or not result.analysis.strip():
            result.analysis = "Food analysis completed."
        if not result.logName or not result.logName.strip():
            result.logName = (
                description.strip() if description and description.strip() else "Meal"
            )

        result.ingredients = normalize_ingredients(result.ingredients, description)
        result = _remove_ungrounded_nutrition_ingredients(result, grounded_ingredients)
        result = _apply_evidence_defaults(result, classification)
        result = _remove_inferred_image_ingredients(result, classification)
        result = await _audit_visual_ingredient_support(client, image_data, result, classification)
        result = _remove_unmentioned_high_risk_bowl_toppings(result, classification, description)
        if not result.ingredients:
            raise AppError(422, "No visually supported food ingredients were found")
        result = _reconcile_nutrition_totals(
            result,
            prefer_reported_calories=has_source_backed_calories and classification.category == "packaged_product",
        )
        result.foodCategory = classification.category
        result.confidence = _compute_heuristic_confidence(result, classification)

        total_ms = int((time.monotonic() - pipeline_t0) * 1000)
        logger.info(
            "===== [pipeline] Complete in %dms | category=%s confidence=%.2f | "
            "logName=%r calories=%.0f ingredients=%d =====",
            total_ms,
            result.foodCategory,
            result.confidence,
            result.logName,
            result.calories,
            len(result.ingredients),
        )

        return result

    except APITimeoutError:
        logger.error("[pipeline] OpenAI API timeout")
        raise AppError(503, "Request timed out")

    except APIError as e:
        status_code = getattr(e, "status_code", None)
        if status_code == 401:
            logger.error("[pipeline] OpenAI authentication error")
            raise AppError(500, "Authentication failed")
        elif status_code == 429:
            logger.error("[pipeline] OpenAI rate limit exceeded")
            raise AppError(503, "Service temporarily unavailable")
        else:
            logger.error("[pipeline] OpenAI API error: %s", getattr(e, "message", str(e)))
            raise AppError(503, "Service temporarily unavailable")

    except TimeoutError:
        logger.error("[pipeline] OpenAI API timeout")
        raise AppError(503, "Request timed out")

    except Exception as e:
        if isinstance(e, AppError):
            raise

        error_msg = str(e).lower()
        if "timeout" in error_msg or "timed out" in error_msg:
            logger.error("[pipeline] Timeout: %s", e)
            raise AppError(503, "Request timed out")
        elif (
            "network" in error_msg
            or "connection" in error_msg
            or "econnrefused" in error_msg
        ):
            logger.error("[pipeline] Network error: %s", e)
            raise AppError(503, "Service temporarily unavailable")
        else:
            logger.error("[pipeline] Unknown error: %s", e, exc_info=True)
            raise AppError(500, "Failed to analyze food image")


async def edit_log(
    ingredients: list[IngredientItem],
    correction: str,
    image_base64: Optional[str] = None,
    source_url: Optional[str] = None,
) -> NutritionResult:
    """Apply a natural-language correction to existing ingredients using GPT-4.1.

    If an image is provided, the model can re-check visible items. For packaged
    product additions, this path may use web search to reduce guessing.
    """
    logger.info(
        "[edit_log] Starting edit: %d ingredients, correction=%r",
        len(ingredients), correction[:80],
    )
    t0 = time.monotonic()

    try:
        client = get_openai_client()
        ingredients_json = json.dumps(
            [ing.model_dump(exclude_none=True) for ing in ingredients],
            indent=2,
        )
        image_data = ""
        if image_base64:
            image_data = image_base64.split(",")[1] if "," in image_base64 else image_base64

        prompt_text = build_edit_log_prompt(
            ingredients_json,
            correction,
            has_image=bool(image_data),
            source_url=source_url,
        )

        correction_lower = correction.lower()
        packaged_keywords = (
            "beer", "cola", "soda", "energy drink", "juice", "bottle", "can",
            "packaged", "brand", "product", "snack", "fruto", "няня", "frutonyanya",
        )
        should_use_web_search = bool(source_url) or (bool(image_data) and any(
            keyword in correction_lower for keyword in packaged_keywords
        ))

        content: Optional[str] = None
        source_domains: list[str] = []
        used_web_search_result = False

        if should_use_web_search:
            try:
                ws_response = await _create_json_response(
                    client,
                    model=PACKAGED_PRODUCT_MODEL,
                    prompt_text=prompt_text,
                    image_data=image_data or None,
                    max_output_tokens=3000,
                    reasoning_effort=PACKAGED_PRODUCT_REASONING_EFFORT,
                    tools=[{"type": "web_search"}],
                    include=["web_search_call.action.sources"],
                    json_mode=False,
                )
                if _has_web_search_calls(ws_response):
                    source_urls = _extract_source_urls(ws_response)
                    source_domains = _source_domains_from_urls(source_urls)
                    content = _extract_json_from_text(_extract_response_text(ws_response))
                    used_web_search_result = True
                    logger.info(
                        "[edit_log] web_search used for edit correction | sources=%s",
                        source_domains if source_domains else "none",
                    )
                else:
                    logger.warning("[edit_log] web_search tool not used in edit path; falling back to chat")
            except Exception as ws_error:
                logger.warning("[edit_log] web_search edit path failed (%s); falling back to chat", ws_error)

        if content is None:
            response = await _create_json_response(
                client,
                model=EDIT_MODEL,
                prompt_text=prompt_text,
                image_data=image_data or None,
                max_output_tokens=_responses_max_output_tokens(1500),
                reasoning_effort=EDIT_REASONING_EFFORT,
                response_schema=NUTRITION_RESULT_JSON_SCHEMA,
            )
            content = response.output_text

        if not content:
            raise AppError(500, "No response from AI service")

        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise AppError(500, "Invalid response format from AI service")

        try:
            result = NutritionResult(**parsed)
        except Exception:
            result = normalize_fallback(parsed, correction)

        result.ingredients = normalize_ingredients(result.ingredients, correction)
        result = _reconcile_nutrition_totals(
            result,
            prefer_reported_calories=used_web_search_result,
        )
        result = _set_verified_sources_on_ingredients(result, source_domains)
        if source_domains:
            sources_note = f"Sources: {', '.join(source_domains[:3])}"
            if result.mealNotes and result.mealNotes.strip():
                if "sources:" not in result.mealNotes.lower():
                    result.mealNotes = f"{result.mealNotes.strip()} | {sources_note}"
            else:
                result.mealNotes = sources_note

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info("[edit_log] Complete in %dms, %d ingredients", elapsed_ms, len(result.ingredients))
        return result

    except AppError:
        raise
    except Exception as e:
        logger.error("[edit_log] Failed: %s", e, exc_info=True)
        raise AppError(500, "Failed to process edit request")


def _format_totals_for_chat(totals: Optional[NutritionTotals]) -> str:
    if totals is None:
        return "No selected-day totals were provided."
    return (
        f"Selected day totals: {round(totals.calories)} kcal, "
        f"{round(totals.protein)}g protein, {round(totals.carbs)}g carbs, "
        f"{round(totals.fats)}g fat."
    )


def _format_meals_for_chat(meals: list[FoodLogContextEntry]) -> str:
    if not meals:
        return "No recent meal logs were provided."

    lines = []
    for meal in meals[:20]:
        ingredients = ", ".join(meal.ingredients[:10]) if meal.ingredients else "ingredients unknown"
        lines.append(
            "- "
            f"{meal.description}: {round(meal.nutrition.calories)} kcal, "
            f"{round(meal.nutrition.protein)}g protein, "
            f"{round(meal.nutrition.carbs)}g carbs, "
            f"{round(meal.nutrition.fats)}g fat. "
            f"Ingredients: {ingredients}."
        )
    return "\n".join(lines)


def _format_goals_for_chat(goals: Optional[NutritionGoals]) -> str:
    if goals is None:
        goals = NutritionGoals()

    return (
        "User goals and preferences. '-' means not set yet:\n"
        f"- Main goal: {goals.goal}\n"
        f"- Target calories: {goals.targetCalories}\n"
        f"- Target protein: {goals.targetProtein}\n"
        f"- Dietary preference: {goals.dietaryPreference}\n"
        f"- Allergies/avoidances: {goals.allergies}\n"
        f"- Activity/training: {goals.activity}\n"
        f"- Notes: {goals.notes}"
    )


def _format_profile_for_analysis(profile: Optional[NutritionProfile]) -> str:
    if profile is None:
        return ""

    lines: list[str] = []
    if profile.summary != "-":
        lines.append(f"Summary: {profile.summary}")
    if profile.tonePreference != "-":
        lines.append(f"Tone preference: {profile.tonePreference}")
    if profile.dislikedAdvice != "-":
        lines.append(f"Advice to avoid: {profile.dislikedAdvice}")

    active_patterns = [pattern for pattern in profile.behaviorPatterns if pattern.active]
    if active_patterns:
        lines.append("Active behavior patterns:")
        for pattern in active_patterns[:8]:
            lines.append(
                f"- {pattern.label}: trigger={pattern.trigger}; context={pattern.context}; "
                f"goal relevance={pattern.goalRelevance}; tone={pattern.tone}"
            )

    if profile.openQuestions:
        lines.append("Open personalization questions:")
        for question in profile.openQuestions[:5]:
            lines.append(f"- {question}")

    return "\n".join(lines)


def _format_profile_for_chat(profile: Optional[NutritionProfile]) -> str:
    formatted = _format_profile_for_analysis(profile)
    return f"Current coach memory:\n{formatted or '-'}"


async def nutritionist_chat(
    messages: list[ChatMessage],
    today_totals: Optional[NutritionTotals] = None,
    recent_meals: Optional[list[FoodLogContextEntry]] = None,
    goals: Optional[NutritionGoals] = None,
    nutrition_profile: Optional[NutritionProfile] = None,
) -> NutritionistChatResult:
    """Reply as a nutrition coach using chat history and recent meal context."""

    client = get_openai_client()
    recent_meals = recent_meals or []
    meal_context = (
        f"{_format_goals_for_chat(goals)}\n\n"
        f"{_format_profile_for_chat(nutrition_profile)}\n\n"
        f"{_format_totals_for_chat(today_totals)}\n\n"
        f"Recent meal logs:\n{_format_meals_for_chat(recent_meals)}"
    )
    instructions = (
        "You are Cali's AI nutritionist coach. Help the user understand their meals, "
        "build context about goals, preferences, schedule, allergies, training, appetite, "
        "and constraints, and make practical comments that can later personalize food log feedback.\n\n"
        "Rules:\n"
        "1. Be concise, warm, and specific.\n"
        "2. Treat '-' goal values as missing, not as literal goals.\n"
        "3. Actively gather missing personalization context instead of guessing. Start with goal "
        "and timeline if unclear. For calorie, protein, fat-loss, muscle-gain, or body-recomposition "
        "advice, ask for the needed basics: current weight, height, age, sex if relevant for BMR, "
        "training/activity pattern, dietary constraints, and typical schedule/appetite.\n"
        "4. Ask at most two focused follow-up questions in one reply, prioritizing the minimum "
        "information needed for the user's current request.\n"
        "5. Do not present precise calorie or macro targets as personalized until weight and activity "
        "context are known; use ranges or explain what information is missing.\n"
        "6. Use the provided meal logs only as context; do not invent meals or medical facts.\n"
        "7. Do not diagnose, prescribe treatment, or give dangerous restriction advice.\n"
        "8. If the user mentions a medical condition, pregnancy, eating disorder, or medication, "
        "recommend working with a qualified clinician.\n"
        "9. Prefer behavioral and meal-planning guidance over exact macro prescriptions unless "
        "the user has shared a clear goal.\n"
        "10. Return JSON with `message` and `goalUpdates`. `message` is the chat reply. "
        "`goalUpdates` is null unless you are confident the user stated or accepted a concrete "
        "goal/target/preference that should update the app's goal fields. When updating goals, "
        "return the complete goal object and preserve unchanged fields exactly from the current "
        "context. Use concise strings like `150 g/day` or `1800 kcal/day`. If the user asks you "
        "to update, save, set, or confirm targets and you have enough information, you must return "
        "`goalUpdates`; do not say goals or targets are updated in `message` while `goalUpdates` "
        "is null.\n"
        "11. Return `profileUpdates` when the user explicitly states, corrects, confirms, or asks "
        "you to remember durable personalization context that should affect future meal comments. "
        "Examples include behavior patterns, preferred tone, advice they dislike, schedule/appetite "
        "constraints, and open personalization questions. Return the complete profile object and "
        "preserve unchanged profile fields exactly. For behavior patterns, use stable snake_case ids "
        "such as `late_sweets`. Set `active` false when the user asks you to forget or stop using a "
        "pattern. Do not create durable memory from meal logs alone; ask for confirmation first. "
        "Do not say you will remember something while `profileUpdates` is null."
    )

    input_messages: list[dict[str, str]] = [
        {"role": "user", "content": f"Context from the app:\n{meal_context}"}
    ]
    input_messages.extend(
        {"role": message.role, "content": message.content}
        for message in messages[-30:]
    )

    started = time.monotonic()
    try:
        logger.info(
            "[nutritionist_chat] Sending request (model=%s, messages=%d, meals=%d)",
            NUTRITIONIST_CHAT_MODEL,
            len(messages),
            len(recent_meals),
        )
        params: dict[str, Any] = {
            "model": NUTRITIONIST_CHAT_MODEL,
            "instructions": instructions,
            "input": input_messages,
            "max_output_tokens": 700,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "nutritionist_chat",
                    "schema": NUTRITIONIST_CHAT_JSON_SCHEMA,
                    "strict": True,
                }
            },
        }
        if not NUTRITIONIST_CHAT_MODEL.startswith("gpt-4.1"):
            params["reasoning"] = {"effort": NUTRITIONIST_CHAT_REASONING_EFFORT}
            params["text"]["verbosity"] = "low"

        response = await client.responses.create(**params)
        elapsed_ms = round((time.monotonic() - started) * 1000)
        content = (response.output_text or "").strip()
        logger.info("[nutritionist_chat] Response received in %dms", elapsed_ms)
        if not content:
            raise AppError(500, "Nutritionist chat returned an empty response")
        try:
            parsed = json.loads(content)
            return NutritionistChatResult(**parsed)
        except Exception:
            logger.warning("[nutritionist_chat] Failed to parse JSON response; returning raw text")
            return NutritionistChatResult(message=content, goalUpdates=None)
    except AppError:
        raise
    except (APITimeoutError, APIError) as exc:
        logger.error("[nutritionist_chat] OpenAI error: %s", exc)
        raise AppError(500, "Failed to generate nutritionist reply")
    except Exception as exc:
        logger.error("[nutritionist_chat] Unexpected error: %s", exc)
        raise AppError(500, "Failed to generate nutritionist reply")


def normalize_ingredients(
    raw: Any,
    description: Optional[str] = None,
) -> list[IngredientItem]:
    if isinstance(raw, list):
        normalized: list[IngredientItem] = []
        for index, item in enumerate(raw):
            if isinstance(item, IngredientItem):
                if item.calories is None or item.calories < 0:
                    item.calories = round(item.carbs * 4 + item.proteins * 4 + item.fats * 9, 1)
                normalized.append(item)
                continue
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            quantity = item.get("quantity")
            carbs = item.get("carbs")
            fats = item.get("fats")
            proteins = item.get("proteins")
            calories = item.get("calories")
            sources = item.get("sources")
            evidence = item.get("evidence")
            if not isinstance(name, str) or not name.strip():
                continue
            if not isinstance(quantity, str) or not quantity.strip():
                continue
            if _is_placeholder_text(name) or _is_placeholder_text(quantity):
                continue
            if not isinstance(carbs, (int, float)) or carbs < 0:
                continue
            if not isinstance(fats, (int, float)) or fats < 0:
                continue
            if not isinstance(proteins, (int, float)) or proteins < 0:
                continue

            parsed_sources: Optional[list[str]] = None
            if isinstance(sources, list):
                parsed_sources = [
                    s.strip()
                    for s in sources
                    if isinstance(s, str) and s.strip()
                ] or None

            parsed_calories = (
                float(calories)
                if isinstance(calories, (int, float)) and calories >= 0
                else round(float(carbs) * 4 + float(proteins) * 4 + float(fats) * 9, 1)
            )

            normalized.append(
                IngredientItem(
                    id=(
                        item["id"]
                        if isinstance(item.get("id"), str) and item["id"].strip()
                        else f"ingredient-{index}"
                    ),
                    name=name.strip(),
                    quantity=quantity.strip(),
                    carbs=float(carbs),
                    fats=float(fats),
                    proteins=float(proteins),
                    calories=parsed_calories,
                    evidence=(
                        evidence
                        if evidence in {"visible", "user_text", "inferred"}
                        else None
                    ),
                    sources=parsed_sources,
                    unit=(
                        item.get("unit").strip()
                        if isinstance(item.get("unit"), str) and item.get("unit").strip()
                        else None
                    ),
                    preparation=(
                        item.get("preparation").strip()
                        if isinstance(item.get("preparation"), str)
                        and item.get("preparation").strip()
                        else None
                    ),
                    note=(
                        item.get("note").strip()
                        if isinstance(item.get("note"), str) and item.get("note").strip()
                        else None
                    ),
                )
            )

        if normalized:
            return normalized

    fallback_name = (
        description.strip()
        if isinstance(description, str) and description.strip()
        else "Meal"
    )
    return [
        IngredientItem(
            id="ingredient-fallback",
            name=fallback_name,
            quantity="1",
            unit="serving",
            carbs=0,
            fats=0,
            proteins=0,
            calories=0,
            evidence="user_text" if isinstance(description, str) and description.strip() else "inferred",
        )
    ]


def normalize_fallback(
    parsed_response: dict[str, Any],
    description: Optional[str],
) -> NutritionResult:
    fallback_ingredients = normalize_ingredients(
        parsed_response.get("ingredients"), description
    )
    return NutritionResult(
        carbs=(
            float(parsed_response["carbs"])
            if isinstance(parsed_response.get("carbs"), (int, float))
            else 0
        ),
        protein=(
            float(parsed_response["protein"])
            if isinstance(parsed_response.get("protein"), (int, float))
            else 0
        ),
        fats=(
            float(parsed_response["fats"])
            if isinstance(parsed_response.get("fats"), (int, float))
            else 0
        ),
        calories=(
            float(parsed_response["calories"])
            if isinstance(parsed_response.get("calories"), (int, float))
            else 0
        ),
        analysis=(
            parsed_response["analysis"].strip()
            if isinstance(parsed_response.get("analysis"), str)
            and parsed_response["analysis"].strip()
            else "Unable to analyze food image."
        ),
        logName=(
            parsed_response["logName"].strip()
            if isinstance(parsed_response.get("logName"), str)
            and parsed_response["logName"].strip()
            else (
                description.strip()
                if isinstance(description, str) and description.strip()
                else "Meal"
            )
        ),
        ingredients=fallback_ingredients,
        mealNotes=(
            parsed_response["mealNotes"].strip()
            if isinstance(parsed_response.get("mealNotes"), str)
            and parsed_response["mealNotes"].strip()
            else None
        ),
    )
