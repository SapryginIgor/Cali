export type GoalType = "lose_weight" | "gain_muscle" | "maintain";

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

export interface DailyGoals {
  carbs: number;
  protein: number;
  fats: number;
  calories: number;
}

export interface UserProfile {
  goal: GoalType;
  dailyGoals: DailyGoals;
  onboardingComplete: boolean;
}

export const DEFAULT_GOALS: Record<GoalType, DailyGoals> = {
  lose_weight: {
    carbs: 150,
    protein: 120,
    fats: 50,
    calories: 1800,
  },
  gain_muscle: {
    carbs: 250,
    protein: 180,
    fats: 70,
    calories: 2800,
  },
  maintain: {
    carbs: 200,
    protein: 150,
    fats: 60,
    calories: 2200,
  },
};
