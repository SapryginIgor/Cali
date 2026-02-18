/**
 * Type definitions matching frontend interfaces
 */

export interface NutritionResult {
  carbs: number;
  protein: number;
  fats: number;
  calories: number;
  analysis: string;
}

export interface AnalyzeFoodRequest {
  image: string; // base64 encoded image string
  description?: string;
  userId?: string; // Optional for future auth
}

export interface AnalyzeFoodResponse extends NutritionResult {}

export interface ErrorResponse {
  error: string;
  message: string;
}
