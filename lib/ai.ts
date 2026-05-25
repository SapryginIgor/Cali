/**
 * AI helpers for food analysis.
 * Uses backend API for OpenAI GPT-4 Vision integration, with fallback to mock.
 */

import { IngredientItem } from "@/constants/types";
import { supabase } from "@/lib/supabase";

export interface NutritionResult {
  carbs: number;
  protein: number;
  fats: number;
  calories: number;
  analysis: string;
  logName: string;
  ingredients: IngredientItem[];
  mealNotes?: string;
  confidence?: number;
  foodCategory?: string;
}

// Backend API configuration
// Set EXPO_PUBLIC_BACKEND_URL environment variable to enable backend API
// For development: http://localhost:3000
// For production: your deployed backend URL
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

/**
 * Convert image URI to base64 string
 * @param imageUri - Local file URI (e.g., from expo-image-picker)
 * @returns Base64 encoded image string
 */
async function imageUriToBase64(imageUri: string): Promise<string> {
  console.log("[Cali API] Converting image to base64...", imageUri?.slice(0, 50));
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    console.log("[Cali API] Image fetched, blob size:", blob.size);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.includes(",")
          ? base64String.split(",")[1]
          : base64String;
        console.log("[Cali API] Base64 conversion done, length:", base64?.length);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("[Cali API] Error converting image to base64:", error);
    throw new Error("Failed to process image");
  }
}

/** Request timeout in ms (backend + OpenAI can take 30–120s for vision/web-search). */
const BACKEND_REQUEST_TIMEOUT_MS = 180_000;

const NETWORK_RETRY_DELAY_MS = 1200;
const NETWORK_RETRY_ATTEMPTS = 2;

function isTransientNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("network request failed")
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call backend API to analyze food (image and/or text description)
 * @param imageBase64 - Base64 encoded image (null for text-only)
 * @param description - Optional text description
 * @returns NutritionResult from backend API
 */
async function callBackendAPI(
  imageBase64: string | null,
  description?: string
): Promise<NutritionResult> {
  if (!BACKEND_URL) {
    throw new Error("Backend URL not configured");
  }

  const url = `${BACKEND_URL}/api/analyze-food`;
  console.log("[Cali API] Sending request to backend:", url, "description:", description ? "yes" : "no");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      console.log("[Cali API] Auth token added, user:", sessionData.session.user?.email);
    } else {
      console.log("[Cali API] No session found, request will be unauthenticated");
    }
  } catch (e) {
    console.log("[Cali API] Session retrieval failed:", e);
  }

  const body: Record<string, string> = {};
  if (imageBase64) body.image = imageBase64;
  if (description) body.description = description;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Request timed out. Check that the backend is running and reachable.")),
      BACKEND_REQUEST_TIMEOUT_MS
    )
  );

  try {
    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
      try {
        response = await Promise.race([
          fetch(url, { method: "POST", headers, body: JSON.stringify(body) }),
          timeoutPromise,
        ]);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isTransientNetworkError(error) || attempt === NETWORK_RETRY_ATTEMPTS) {
          throw error;
        }
        console.warn(
          `[Cali API] Transient network error on attempt ${attempt}/${NETWORK_RETRY_ATTEMPTS}, retrying...`
        );
        await wait(NETWORK_RETRY_DELAY_MS * attempt);
      }
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error("Backend request failed"));
    }

    console.log("[Cali API] Backend response status:", response.status, response.statusText);

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { message?: string; detail?: string };
          errorMessage = parsed.message || parsed.detail || rawText;
        } catch {
          errorMessage = rawText;
        }
      }
      console.error("[Cali API] Backend error body:", rawText || "(empty)");
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("[Cali API] Backend response OK, data keys:", Object.keys(data));

    if (
      typeof data.carbs === "number" &&
      typeof data.protein === "number" &&
      typeof data.fats === "number" &&
      typeof data.calories === "number" &&
      typeof data.analysis === "string"
    ) {
      return {
        carbs: data.carbs,
        protein: data.protein,
        fats: data.fats,
        calories: data.calories,
        analysis: data.analysis,
        logName:
          typeof data.logName === "string" && data.logName.trim().length > 0
            ? data.logName.trim()
            : description?.trim() || "Meal",
        ingredients: normalizeIngredientsFromApi(data.ingredients),
        mealNotes: typeof data.mealNotes === "string" ? data.mealNotes : undefined,
        confidence: typeof data.confidence === "number" ? data.confidence : undefined,
        foodCategory: typeof data.foodCategory === "string" ? data.foodCategory : undefined,
      };
    } else {
      throw new Error("Invalid response format from backend");
    }
  } catch (error) {
    console.error("[Cali API] Backend request failed:", error);
    throw error instanceof Error ? error : new Error("Failed to call backend API");
  }
}

/** Mock: derive rough nutrition from description or return defaults. */
function estimateNutrition(description: string): NutritionResult {
  const d = (description || "meal").toLowerCase();
  // Very rough heuristic estimates for common terms
  let calories = 400;
  let protein = 20;
  let carbs = 45;
  let fats = 15;
  if (d.includes("salad") || d.includes("vegetable")) {
    calories = 120;
    protein = 6;
    carbs = 15;
    fats = 4;
  } else if (d.includes("chicken") || d.includes("grilled")) {
    calories = 350;
    protein = 35;
    carbs = 5;
    fats = 18;
  } else if (d.includes("pasta") || d.includes("rice") || d.includes("bread")) {
    calories = 450;
    protein = 12;
    carbs = 70;
    fats = 10;
  } else if (d.includes("burger") || d.includes("pizza") || d.includes("fried")) {
    calories = 600;
    protein = 25;
    carbs = 50;
    fats = 35;
  }
  return {
    carbs,
    protein,
    fats,
    calories,
    analysis: `Estimated nutrition for "${description || "your meal"}. Add your own AI provider in lib/ai.ts for accurate analysis."`,
    logName: description?.trim() || "Meal",
    ingredients: [
      {
        id: `mock-${Date.now()}`,
        name: description || "Meal",
        quantity: "1 serving",
        carbs,
        fats,
        proteins: protein,
        calories,
      },
    ],
  };
}

function normalizeIngredientsFromApi(raw: unknown): IngredientItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index): IngredientItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const data = item as Record<string, unknown>;
      const name = typeof data.name === "string" ? data.name.trim() : "";
      const quantity = typeof data.quantity === "string" ? data.quantity.trim() : "";
      const placeholderValues = new Set(["-", "—", "_", "n/a", "na", "none", "unknown", "null"]);
      const nameLower = name.toLowerCase();
      const quantityLower = quantity.toLowerCase();

      if (
        !name ||
        !quantity ||
        placeholderValues.has(nameLower) ||
        placeholderValues.has(quantityLower)
      ) {
        return null;
      }

      const ingredient: IngredientItem = {
        id:
          typeof data.id === "string" && data.id.trim().length > 0
            ? data.id
            : `ai-${Date.now()}-${index}`,
        name,
        quantity,
        carbs:
          typeof data.carbs === "number" && Number.isFinite(data.carbs) && data.carbs >= 0
            ? data.carbs
            : 0,
        fats:
          typeof data.fats === "number" && Number.isFinite(data.fats) && data.fats >= 0
            ? data.fats
            : 0,
        proteins:
          typeof data.proteins === "number" &&
          Number.isFinite(data.proteins) &&
          data.proteins >= 0
            ? data.proteins
            : 0,
        calories:
          typeof data.calories === "number" &&
          Number.isFinite(data.calories) &&
          data.calories >= 0
            ? data.calories
            : Math.round(
                (((typeof data.carbs === "number" ? data.carbs : 0) * 4 +
                  (typeof data.proteins === "number" ? data.proteins : 0) * 4 +
                  (typeof data.fats === "number" ? data.fats : 0) * 9) as number) *
                  10
              ) / 10,
        sources:
          Array.isArray(data.sources) && data.sources.length > 0
            ? data.sources
                .filter((source): source is string => typeof source === "string" && source.trim().length > 0)
                .map((source) => source.trim())
            : undefined,
        unit: typeof data.unit === "string" && data.unit.trim() ? data.unit.trim() : undefined,
        preparation:
          typeof data.preparation === "string" && data.preparation.trim()
            ? data.preparation.trim()
            : undefined,
        note: typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined,
      };
      return ingredient;
    })
    .filter((item): item is IngredientItem => item !== null);
}

/**
 * Call backend to apply a natural-language correction to existing ingredients.
 */
export async function editLogWithAI(
  ingredients: IngredientItem[],
  correction: string,
  imageUri?: string
): Promise<NutritionResult> {
  if (!BACKEND_URL) {
    throw new Error("Backend URL not configured");
  }

  const url = `${BACKEND_URL}/api/edit-log`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
    }
  } catch (e) {
    console.log("[Cali API] Session retrieval failed:", e);
  }

  const imageBase64 = imageUri ? await imageUriToBase64(imageUri) : null;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out.")), BACKEND_REQUEST_TIMEOUT_MS)
  );

  try {
    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
      try {
        response = await Promise.race([
          fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              ingredients,
              correction,
              ...(imageBase64 ? { image: imageBase64 } : {}),
            }),
          }),
          timeoutPromise,
        ]);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isTransientNetworkError(error) || attempt === NETWORK_RETRY_ATTEMPTS) {
          throw error;
        }
        console.warn(
          `[Cali API] Edit request transient network error on attempt ${attempt}/${NETWORK_RETRY_ATTEMPTS}, retrying...`
        );
        await wait(NETWORK_RETRY_DELAY_MS * attempt);
      }
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error("Backend request failed"));
    }

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { message?: string; detail?: string };
          errorMessage = parsed.message || parsed.detail || rawText;
        } catch {
          errorMessage = rawText;
        }
      }
      console.error("[Cali API] Backend error body:", rawText || "(empty)");
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (
      typeof data.carbs === "number" &&
      typeof data.protein === "number" &&
      typeof data.fats === "number" &&
      typeof data.calories === "number" &&
      typeof data.analysis === "string"
    ) {
      return {
        carbs: data.carbs,
        protein: data.protein,
        fats: data.fats,
        calories: data.calories,
        analysis: data.analysis,
        logName: typeof data.logName === "string" ? data.logName.trim() : "Meal",
        ingredients: normalizeIngredientsFromApi(data.ingredients),
      };
    } else {
      throw new Error("Invalid response format from backend");
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to call backend API");
  }
}

/** Compatible with previous generateObject usage (messages + schema). Returns nutrition data from backend API or mock fallback. */
export async function generateObject<T>(options: {
  messages: ({ role: string; content: unknown } | { role: string; content: unknown[] })[];
  schema: unknown;
}): Promise<T> {
  const e2eDelay = Number(process.env.EXPO_PUBLIC_E2E_DELAY_MS || 0);
  if (Number.isFinite(e2eDelay) && e2eDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, e2eDelay));
  }

  const first = options.messages[0];
  if (!first || typeof first !== "object" || !("content" in first)) {
    console.log("[Cali API] Using mock (no message content)");
    return estimateNutrition("meal") as T;
  }

  const content = first.content;
  let description: string | undefined;
  let imageUri: string | undefined;

  // Extract description and image URI from messages
  if (typeof content === "string") {
    const match = content.match(/Description:\s*(.+)$/i);
    description = match ? match[1].trim() : undefined;
  } else if (Array.isArray(content)) {
    // Find text part for description
    const textPart = content.find((c: { type?: string; text?: string }) => c.type === "text" && c.text);
    if (textPart && typeof (textPart as { text?: string }).text === "string") {
      const t = (textPart as { text: string }).text;
      const ctx = t.match(/Additional context:\s*(.+)/i);
      description = ctx ? ctx[1].trim() : undefined;
    }

    // Find image part
    const imagePart = content.find((c: { type?: string; image?: string }) => c.type === "image" && c.image);
    if (imagePart && typeof (imagePart as { image?: string }).image === "string") {
      imageUri = (imagePart as { image: string }).image;
    }
  }

  // If backend URL is configured and we have an image, use backend API
  if (process.env.EXPO_PUBLIC_E2E === "1") {
    return estimateNutrition(description || "meal") as T;
  }

  if (BACKEND_URL && (imageUri || description)) {
    console.log("[Cali API] Using backend:", BACKEND_URL, "| imageUri:", !!imageUri, "| description:", !!description);
    try {
      const imageBase64 = imageUri ? await imageUriToBase64(imageUri) : null;
      const result = await callBackendAPI(imageBase64, description);
      console.log("[Cali API] Backend success, calories:", result.calories);
      return result as T;
    } catch (error) {
      console.error("[Cali API] Backend failed, falling back to mock:", error);
      return estimateNutrition(description || "meal") as T;
    }
  }

  console.log("[Cali API] Using mock (no BACKEND_URL or no input). BACKEND_URL:", BACKEND_URL || "(empty)");
  return estimateNutrition(description || "meal") as T;
}

/** Mock: return static tips. Replace with your AI provider for real tips. */
export async function generateText(_prompt: string): Promise<string> {
  return "Keep up the great work tracking your nutrition! Stay consistent with your goals and adjust portions based on your progress.";
}
