import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FoodEntry, UserProfile, DEFAULT_GOALS, GoalType } from "@/constants/types";

const STORAGE_KEY_PROFILE = "nutrition_profile";
const STORAGE_KEY_ENTRIES = "nutrition_entries";

export const [AppProvider, useApp] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
      return stored ? JSON.parse(stored) : null;
    },
  });

  const entriesQuery = useQuery({
    queryKey: ["entries"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ENTRIES);
      return stored ? JSON.parse(stored) : [];
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: UserProfile) => {
      await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));
      return newProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
    },
  });

  const saveEntriesMutation = useMutation({
    mutationFn: async (newEntries: FoodEntry[]) => {
      await AsyncStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(newEntries));
      return newEntries;
    },
    onSuccess: (data) => {
      setEntries(data);
    },
  });

  useEffect(() => {
    if (profileQuery.data !== undefined) {
      setProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (entriesQuery.data) {
      setEntries(entriesQuery.data);
    }
  }, [entriesQuery.data]);

  const completeOnboarding = (goal: GoalType) => {
    const newProfile: UserProfile = {
      goal,
      dailyGoals: DEFAULT_GOALS[goal],
      onboardingComplete: true,
    };
    saveProfileMutation.mutate(newProfile);
  };

  const addFoodEntry = (entry: FoodEntry) => {
    const updated = [...entries, entry];
    saveEntriesMutation.mutate(updated);
  };

  const getTodayEntries = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    return entries.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === todayTime;
    });
  };

  const getTodayTotals = () => {
    const todayEntries = getTodayEntries();
    return todayEntries.reduce(
      (acc, entry) => ({
        carbs: acc.carbs + entry.nutrition.carbs,
        protein: acc.protein + entry.nutrition.protein,
        fats: acc.fats + entry.nutrition.fats,
        calories: acc.calories + entry.nutrition.calories,
      }),
      { carbs: 0, protein: 0, fats: 0, calories: 0 }
    );
  };

  return {
    profile,
    entries,
    isLoading: profileQuery.isLoading || entriesQuery.isLoading,
    completeOnboarding,
    addFoodEntry,
    getTodayEntries,
    getTodayTotals,
  };
});
