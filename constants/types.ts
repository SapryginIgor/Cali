export interface IngredientItem {
  id: string;
  name: string;
  quantity: string;
  carbs: number;
  fats: number;
  proteins: number;
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
  analysisStatus?: "pending" | "completed" | "failed";
  analysisError?: string;
  nutrition: {
    carbs: number;
    protein: number;
    fats: number;
    calories: number;
  };
  aiAnalysis?: string;
}
