export interface FoodEntry {
  id: string;
  timestamp: number;
  description: string;
  imageUri?: string;
  nutrition: {
    carbs: number;
    protein: number;
    fats: number;
    calories: number;
  };
  aiAnalysis?: string;
}
