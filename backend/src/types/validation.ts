/**
 * Zod schemas for request validation
 */

import { z } from "zod";

export const nutritionResultSchema = z.object({
  carbs: z.number().describe("Carbohydrates in grams"),
  protein: z.number().describe("Protein in grams"),
  fats: z.number().describe("Fats in grams"),
  calories: z.number().describe("Total calories"),
  analysis: z.string().describe("Brief analysis of the food"),
});

export const analyzeFoodRequestSchema = z.object({
  image: z.string().min(1, "Image is required"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  userId: z.string().optional(),
});

// Maximum image size: 10MB (in bytes)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Supported image formats
export const SUPPORTED_IMAGE_FORMATS = ["image/jpeg", "image/png", "image/webp"];
