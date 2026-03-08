"""
OpenAI service for food image analysis
Uses GPT-4 Vision API with structured outputs
"""

import os
import json
from typing import Optional
from openai import AsyncOpenAI, APIError
from app.models.api import NutritionResult
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
        
        # Construct prompt
        prompt = "Analyze this food image and provide nutritional information.\n\n"
        prompt += "Return structured data with:\n"
        prompt += "- Carbohydrates in grams\n"
        prompt += "- Protein in grams\n"
        prompt += "- Fats in grams\n"
        prompt += "- Total calories\n"
        prompt += "- Brief analysis of the food\n\n"
        
        if description:
            prompt += f"Additional context: {description}\n\n"
        
        prompt += "Return the data as a JSON object with fields: carbs, protein, fats, calories (all numbers), and analysis (string)."
        
        # Call OpenAI API with GPT-4 Vision
        response = await client.chat.completions.create(
            model="gpt-4o",  # Using gpt-4o which supports vision
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
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
            response_format={"type": "json_object"},  # Structured output
            max_tokens=500,
        )
        
        # Extract and parse response
        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise AppError(500, "No response from AI service")
        
        # Parse JSON response
        try:
            parsed_response = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"Failed to parse OpenAI response: {content}")
            raise AppError(500, "Invalid response format from AI service")
        
        # Validate response matches NutritionResult schema
        try:
            result = NutritionResult(**parsed_response)
        except Exception as e:
            print(f"OpenAI response validation failed: {e}")
            # Attempt to extract valid data or use defaults
            result = NutritionResult(
                carbs=float(parsed_response.get("carbs", 0)) if isinstance(parsed_response.get("carbs"), (int, float)) else 0,
                protein=float(parsed_response.get("protein", 0)) if isinstance(parsed_response.get("protein"), (int, float)) else 0,
                fats=float(parsed_response.get("fats", 0)) if isinstance(parsed_response.get("fats"), (int, float)) else 0,
                calories=float(parsed_response.get("calories", 0)) if isinstance(parsed_response.get("calories"), (int, float)) else 0,
                analysis=str(parsed_response.get("analysis", "Unable to analyze food image.")).strip() or "Food analysis completed.",
            )
        
        # Ensure analysis text is non-empty
        if not result.analysis or not result.analysis.strip():
            result.analysis = "Food analysis completed."
        
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
