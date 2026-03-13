"""
OpenAI service for food image analysis
Uses GPT-4 Vision API with structured outputs
"""

import os
import json
from typing import Any, Optional
from openai import AsyncOpenAI, APIError
from app.models.api import IngredientItem, NutritionResult
from app.exceptions import AppError

# Lazy initialization - client created on first use
_openai_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    """
    Get or create OpenAI client instance
    Initializes on first call to ensure environment variables are loaded
    """
    global _openai_client
    
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AppError(500, "OpenAI API key not configured")
        
        _openai_client = AsyncOpenAI(api_key=api_key)
    
    return _openai_client


async def analyze_food_image(
    image_base64: str,
    description: Optional[str] = None
) -> NutritionResult:
    """
    Analyzes a food image and returns nutrition data
    
    Args:
        image_base64: Base64 encoded image string (with or without data URL prefix)
        description: Optional text description of the food
        
    Returns:
        NutritionResult with carbs, protein, fats, calories, and analysis
        
    Raises:
        AppError: For various error conditions (API failures, timeouts, etc.)
    """
    try:
        # Get client (initializes on first call, after env vars are loaded)
        client = get_openai_client()
        
        # Format image data for OpenAI API
        # Remove data URL prefix if present (data:image/jpeg;base64,)
        image_data = image_base64
        if "," in image_base64:
            image_data = image_base64.split(",")[1]
        
        def build_prompt(force_strict_json: bool) -> str:
            prompt = "Analyze this food image and provide nutritional information.\n\n"
            prompt += "Return ONLY a JSON object with this exact shape:\n"
            prompt += (
                '{ "carbs": number, "protein": number, "fats": number, "calories": number, '
                '"analysis": string, "logName": string, '
                '"ingredients": [{"id": string, "name": string, "quantity": string, '
                '"carbs": number, "fats": number, "proteins": number, "unit"?: string, '
                '"preparation"?: string, "note"?: string}], "mealNotes"?: string }\n\n'
            )
            prompt += "Requirements:\n"
            prompt += "- `ingredients` MUST include one item per identified ingredient/component\n"
            prompt += "- Every ingredient MUST include non-empty `name` and `quantity`\n"
            prompt += "- Every ingredient MUST include numeric `carbs`, `fats`, and `proteins` in grams (>= 0)\n"
            prompt += "- `logName` MUST be a short, human-friendly title for this meal log (2-6 words)\n"
            prompt += "- Use concise strings for `quantity` (examples: \"120 g\", \"1 tbsp\", \"to taste\")\n"
            prompt += "- `analysis` should be brief and useful\n"
            prompt += "- Do not include markdown, code fences, or extra keys\n\n"

            if description:
                prompt += f"Additional context: {description}\n\n"
            if force_strict_json:
                prompt += "Previous response was invalid. Respond with valid JSON only."
            return prompt

        async def make_request(force_strict_json: bool) -> str:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": build_prompt(force_strict_json),
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}",
                                },
                            },
                        ],
                    },
                ],
                response_format={"type": "json_object"},
                max_tokens=700,
            )
            content = response.choices[0].message.content if response.choices else None
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

        for attempt in range(2):
            content = await make_request(attempt > 0)
            parsed_response = parse_response_content(content)
            try:
                result = NutritionResult(**parsed_response)
                break
            except Exception as validation_error:
                print(f"OpenAI response validation failed (attempt {attempt + 1}): {validation_error}")

        if result is None:
            result = normalize_fallback(parsed_response, description)

        if not result.analysis or not result.analysis.strip():
            result.analysis = "Food analysis completed."
        if not result.logName or not result.logName.strip():
            result.logName = description.strip() if description and description.strip() else "Meal"

        result.ingredients = normalize_ingredients(result.ingredients, description)
        return result
        
    except APIError as e:
        # Handle OpenAI API errors
        if e.status_code == 401:
            print("OpenAI API authentication error")
            raise AppError(500, "Authentication failed")
        elif e.status_code == 429:
            print("OpenAI API rate limit error")
            raise AppError(503, "Service temporarily unavailable")
        else:
            print(f"OpenAI API error: {e.message}")
            raise AppError(503, "Service temporarily unavailable")
    
    except TimeoutError:
        print("OpenAI API timeout")
        raise AppError(503, "Request timed out")
    
    except Exception as e:
        # Handle network errors and other exceptions
        if isinstance(e, AppError):
            raise
        
        error_msg = str(e).lower()
        if "timeout" in error_msg or "timed out" in error_msg:
            print("OpenAI API timeout")
            raise AppError(503, "Request timed out")
        elif "network" in error_msg or "connection" in error_msg or "econnrefused" in error_msg:
            print(f"OpenAI API network error: {e}")
            raise AppError(503, "Service temporarily unavailable")
        else:
            print(f"Unknown error in analyze_food_image: {e}")
            raise AppError(500, "Failed to analyze food image")


def normalize_ingredients(
    raw: Any,
    description: Optional[str] = None
) -> list[IngredientItem]:
    if isinstance(raw, list):
        normalized: list[IngredientItem] = []
        for index, item in enumerate(raw):
            if isinstance(item, IngredientItem):
                normalized.append(item)
                continue
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            quantity = item.get("quantity")
            carbs = item.get("carbs")
            fats = item.get("fats")
            proteins = item.get("proteins")
            if not isinstance(name, str) or not name.strip():
                continue
            if not isinstance(quantity, str) or not quantity.strip():
                continue
            if not isinstance(carbs, (int, float)) or carbs < 0:
                continue
            if not isinstance(fats, (int, float)) or fats < 0:
                continue
            if not isinstance(proteins, (int, float)) or proteins < 0:
                continue

            normalized.append(
                IngredientItem(
                    id=item["id"] if isinstance(item.get("id"), str) and item["id"].strip() else f"ingredient-{index}",
                    name=name.strip(),
                    quantity=quantity.strip(),
                    carbs=float(carbs),
                    fats=float(fats),
                    proteins=float(proteins),
                    unit=item.get("unit").strip() if isinstance(item.get("unit"), str) and item.get("unit").strip() else None,
                    preparation=item.get("preparation").strip()
                    if isinstance(item.get("preparation"), str) and item.get("preparation").strip()
                    else None,
                    note=item.get("note").strip() if isinstance(item.get("note"), str) and item.get("note").strip() else None,
                )
            )

        if normalized:
            return normalized

    fallback_name = description.strip() if isinstance(description, str) and description.strip() else "Meal"
    return [
        IngredientItem(
            id="ingredient-fallback",
            name=fallback_name,
            quantity="1 serving",
            carbs=0,
            fats=0,
            proteins=0,
        )
    ]


def normalize_fallback(
    parsed_response: dict[str, Any],
    description: Optional[str]
) -> NutritionResult:
    fallback_ingredients = normalize_ingredients(parsed_response.get("ingredients"), description)
    return NutritionResult(
        carbs=float(parsed_response["carbs"]) if isinstance(parsed_response.get("carbs"), (int, float)) else 0,
        protein=float(parsed_response["protein"]) if isinstance(parsed_response.get("protein"), (int, float)) else 0,
        fats=float(parsed_response["fats"]) if isinstance(parsed_response.get("fats"), (int, float)) else 0,
        calories=float(parsed_response["calories"]) if isinstance(parsed_response.get("calories"), (int, float)) else 0,
        analysis=parsed_response["analysis"].strip()
        if isinstance(parsed_response.get("analysis"), str) and parsed_response["analysis"].strip()
        else "Unable to analyze food image.",
        logName=parsed_response["logName"].strip()
        if isinstance(parsed_response.get("logName"), str) and parsed_response["logName"].strip()
        else (description.strip() if isinstance(description, str) and description.strip() else "Meal"),
        ingredients=fallback_ingredients,
        mealNotes=parsed_response["mealNotes"].strip()
        if isinstance(parsed_response.get("mealNotes"), str) and parsed_response["mealNotes"].strip()
        else None,
    )
