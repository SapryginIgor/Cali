"""
OpenAI service for food image analysis.
Two-step classify-then-analyze pipeline using GPT-5.6 vision models.
"""

import json
import logging
import os
import time
from urllib.parse import urlparse
from typing import Any, Optional

from openai import APIError, APITimeoutError

from app.models.api import (
    ClassificationResult,
    IngredientItem,
    NutritionResult,
    VALID_FOOD_CATEGORIES,
)
from app.exceptions import AppError
from app.services.prompts import CLASSIFICATION_PROMPT, get_analysis_prompt, build_edit_log_prompt
from app.services._openai_client import get_openai_client

logger = logging.getLogger(__name__)

CLASSIFICATION_MODEL = os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-5.6-luna")
ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-5.6-terra")
PACKAGED_PRODUCT_MODEL = os.getenv("OPENAI_PACKAGED_PRODUCT_MODEL", "gpt-5.6-sol")
EDIT_MODEL = os.getenv("OPENAI_EDIT_MODEL", "gpt-5.6-terra")

CLASSIFICATION_REASONING_EFFORT = os.getenv("OPENAI_CLASSIFICATION_REASONING_EFFORT", "low")
ANALYSIS_REASONING_EFFORT = os.getenv("OPENAI_ANALYSIS_REASONING_EFFORT", "medium")
PACKAGED_PRODUCT_REASONING_EFFORT = os.getenv("OPENAI_PACKAGED_PRODUCT_REASONING_EFFORT", "high")
EDIT_REASONING_EFFORT = os.getenv("OPENAI_EDIT_REASONING_EFFORT", "medium")


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
        "reasoning": {"effort": reasoning_effort},
    }
    if json_mode:
        params["text"] = {"format": {"type": "json_object"}, "verbosity": "low"}
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
    if not image_base64:
        logger.info("[classify] No image provided → text_only")
        return ClassificationResult(category="text_only", hints={})

    try:
        client = get_openai_client()

        image_data = image_base64
        if "," in image_base64:
            image_data = image_base64.split(",")[1]

        prompt_text = CLASSIFICATION_PROMPT
        if description:
            prompt_text += f"\nUser description: {description}\n"

        logger.info(
            "[classify] Sending classification request (model=%s, reasoning=%s, detail=low, description=%s)",
            CLASSIFICATION_MODEL,
            CLASSIFICATION_REASONING_EFFORT,
            "yes" if description else "no",
        )
        t0 = time.monotonic()

        response = await _create_json_response(
            client,
            model=CLASSIFICATION_MODEL,
            prompt_text=prompt_text,
            image_data=image_data,
            image_detail="low",
            max_output_tokens=800,
            reasoning_effort=CLASSIFICATION_REASONING_EFFORT,
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


def _extract_source_domains(response: Any) -> list[str]:
    """Extract cited source domains from Responses API annotations."""
    domains: list[str] = []
    def add_url(url: Any) -> None:
        if not isinstance(url, str) or not url.strip():
            return
        try:
            domain = urlparse(url).netloc.lower()
            if domain and domain not in domains:
                domains.append(domain)
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
    image_data: str,
    prompt_text: str,
) -> tuple[str, list[str]]:
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
        max_output_tokens=3000,
        reasoning_effort=PACKAGED_PRODUCT_REASONING_EFFORT,
        tools=[{"type": "web_search"}],
        include=["web_search_call.action.sources"],
        json_mode=False,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    logger.info("[web_search] Response received in %dms", elapsed_ms)

    used_search = _has_web_search_calls(response)
    source_domains = _extract_source_domains(response)
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
    return json_text, source_domains


async def analyze_food_image(
    image_base64: Optional[str] = None,
    description: Optional[str] = None,
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

        # --- Step 2: Build category-specific prompt ---
        prompt_text, max_tokens = get_analysis_prompt(
            classification.category, description, classification.hints
        )
        logger.info(
            "[analyze] Branch selected: category=%s | max_tokens=%d | prompt length=%d chars",
            classification.category, max_tokens, len(prompt_text),
        )

        async def make_request(force_strict_json: bool) -> str:
            text = prompt_text
            if force_strict_json:
                text += "\nPrevious response was invalid. Respond with valid JSON only."

            request_image_data = image_data if classification.category != "text_only" else None

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
                ws_content, source_domains = await _analyze_with_web_search(
                    client, image_data, prompt_text
                )
                parsed_response = parse_response_content(ws_content)
                result = NutritionResult(**parsed_response)
                has_source_backed_calories = True
                logger.info("[analyze] Web search analysis succeeded")
                result = _set_verified_sources_on_ingredients(result, source_domains)
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
                    retry_content, retry_sources = await _analyze_with_web_search(
                        client, image_data, strict_multi_item_prompt
                    )
                    retry_parsed = parse_response_content(retry_content)
                    retry_result = NutritionResult(**retry_parsed)
                    retry_result = _set_verified_sources_on_ingredients(retry_result, retry_sources)
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

        if not result.analysis or not result.analysis.strip():
            result.analysis = "Food analysis completed."
        if not result.logName or not result.logName.strip():
            result.logName = (
                description.strip() if description and description.strip() else "Meal"
            )

        result.ingredients = normalize_ingredients(result.ingredients, description)
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
        )

        correction_lower = correction.lower()
        packaged_keywords = (
            "beer", "cola", "soda", "energy drink", "juice", "bottle", "can",
            "packaged", "brand", "product", "snack", "fruto", "няня", "frutonyanya",
        )
        should_use_web_search = bool(image_data) and any(
            keyword in correction_lower for keyword in packaged_keywords
        )

        content: Optional[str] = None
        source_domains: list[str] = []
        used_web_search_result = False

        if should_use_web_search:
            try:
                ws_response = await _create_json_response(
                    client,
                    model=PACKAGED_PRODUCT_MODEL,
                    prompt_text=prompt_text,
                    image_data=image_data,
                    max_output_tokens=3000,
                    reasoning_effort=PACKAGED_PRODUCT_REASONING_EFFORT,
                    tools=[{"type": "web_search"}],
                    include=["web_search_call.action.sources"],
                    json_mode=False,
                )
                if _has_web_search_calls(ws_response):
                    source_domains = _extract_source_domains(ws_response)
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
            quantity="1 serving",
            carbs=0,
            fats=0,
            proteins=0,
            calories=0,
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
