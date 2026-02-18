/**
 * OpenAI service for food image analysis
 * Uses GPT-4 Vision API with structured outputs
 */

import OpenAI from "openai";
import { NutritionResult } from "../types/api";
import { nutritionResultSchema } from "../types/validation";
import { AppError } from "../middleware/errorHandler";

// Lazy initialization - client created on first use (after dotenv.config() runs)
let openai: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 * Initializes on first call to ensure dotenv.config() has run
 */
function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError(500, "OpenAI API key not configured");
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

/**
 * Analyzes a food image and returns nutrition data
 * @param imageBase64 - Base64 encoded image string (with or without data URL prefix)
 * @param description - Optional text description of the food
 * @returns NutritionResult with carbs, protein, fats, calories, and analysis
 */
export async function analyzeFoodImage(
  imageBase64: string,
  description?: string
): Promise<NutritionResult> {
  try {
    // Get client (initializes on first call, after env vars are loaded)
    const client = getOpenAIClient();

    // Format image data for OpenAI API
    // Remove data URL prefix if present (data:image/jpeg;base64,)
    let imageData = imageBase64;
    if (imageBase64.includes(",")) {
      imageData = imageBase64.split(",")[1];
    }

    // Construct prompt
    let prompt = "Analyze this food image and provide nutritional information.\n\n";
    prompt += "Return structured data with:\n";
    prompt += "- Carbohydrates in grams\n";
    prompt += "- Protein in grams\n";
    prompt += "- Fats in grams\n";
    prompt += "- Total calories\n";
    prompt += "- Brief analysis of the food\n\n";
    
    if (description) {
      prompt += `Additional context: ${description}\n\n`;
    }
    
    prompt += "Return the data as a JSON object with fields: carbs, protein, fats, calories (all numbers), and analysis (string).";

    // Call OpenAI API with GPT-4 Vision
    const response = await client.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o which supports vision
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" }, // Structured output
      max_tokens: 500,
    });

    // Extract and parse response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AppError(500, "No response from AI service");
    }

    // Parse JSON response
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new AppError(500, "Invalid response format from AI service");
    }

    // Validate response matches NutritionResult schema
    const validationResult = nutritionResultSchema.safeParse(parsedResponse);
    if (!validationResult.success) {
      console.error("OpenAI response validation failed:", validationResult.error);
      // Attempt to extract valid data or use defaults
      const data = parsedResponse as Record<string, unknown>;
      const result: NutritionResult = {
        carbs: typeof data.carbs === "number" ? data.carbs : 0,
        protein: typeof data.protein === "number" ? data.protein : 0,
        fats: typeof data.fats === "number" ? data.fats : 0,
        calories: typeof data.calories === "number" ? data.calories : 0,
        analysis: typeof data.analysis === "string" && data.analysis.trim() 
          ? data.analysis.trim() 
          : "Unable to analyze food image.",
      };
      return result;
    }

    // Ensure analysis text is non-empty
    const result = validationResult.data;
    if (!result.analysis || result.analysis.trim().length === 0) {
      result.analysis = "Food analysis completed.";
    }

    return result;
  } catch (error) {
    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        console.error("OpenAI API authentication error");
        throw new AppError(500, "Authentication failed");
      }
      if (error.status === 429) {
        console.error("OpenAI API rate limit error");
        throw new AppError(503, "Service temporarily unavailable");
      }
      console.error("OpenAI API error:", error.message);
      throw new AppError(503, "Service temporarily unavailable");
    }

    // Handle timeout errors
    if (error instanceof Error && (error.message.includes("timeout") || error.name === "TimeoutError")) {
      console.error("OpenAI API timeout");
      throw new AppError(503, "Request timed out");
    }

    // Handle network errors
    if (error instanceof Error && (error.message.includes("network") || error.message.includes("ECONNREFUSED"))) {
      console.error("OpenAI API network error:", error.message);
      throw new AppError(503, "Service temporarily unavailable");
    }

    // Re-throw AppError instances
    if (error instanceof AppError) {
      throw error;
    }

    // Unknown error
    console.error("Unknown error in analyzeFoodImage:", error);
    throw new AppError(500, "Failed to analyze food image");
  }
}
