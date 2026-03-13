import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FoodEntry } from "@/constants/types";

const STORAGE_KEY_ENTRIES = "nutrition_entries";

export const [AppProvider, useApp] = createContextHook(() => {
  const [entries, setEntries] = useState<FoodEntry[]>([]);

  const entriesQuery = useQuery({
    queryKey: ["entries"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ENTRIES);
      return stored ? JSON.parse(stored) : [];
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
    if (entriesQuery.data) {
      setEntries(entriesQuery.data);
    }
  }, [entriesQuery.data]);

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
    entries,
    isLoading: entriesQuery.isLoading,
    addFoodEntry,
    getTodayEntries,
    getTodayTotals,
  };
});
