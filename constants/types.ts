export type SubscriptionStatus = "trialing" | "trial_expired" | "premium" | "cancelled";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  updated_at: string;
  subscription_status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
}

export interface IngredientItem {
  id: string;
  name: string;
  quantity: string;
  carbs: number;
  fats: number;
  proteins: number;
  calories: number;
  evidence?: "visible" | "user_text" | "inferred";
  sources?: string[];
  unit?: string;
  preparation?: string;
  note?: string;
}

export interface FoodEntry {
  id: string;
  timestamp: number;
  description: string;
  pendingDescription?: string;
  mealNotes?: string;
  ingredients: IngredientItem[];
  imageUri?: string;
  productImageUrl?: string;
  analysisStatus?: "pending" | "completed" | "failed";
  analysisError?: string;
  nutrition: {
    carbs: number;
    protein: number;
    fats: number;
    calories: number;
  };
  aiAnalysis?: string;
  confidence?: number;
  foodCategory?: string;
}

export interface NutritionGoals {
  goal: string;
  targetCalories: string;
  targetProtein: string;
  dietaryPreference: string;
  allergies: string;
  activity: string;
  notes: string;
}

export interface BehaviorPattern {
  id: string;
  label: string;
  trigger: string;
  context: string;
  goalRelevance: string;
  tone: string;
  active: boolean;
}

export interface NutritionProfile {
  summary: string;
  behaviorPatterns: BehaviorPattern[];
  dislikedAdvice: string;
  tonePreference: string;
  openQuestions: string[];
}
