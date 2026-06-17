import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FoodEntry } from "@/constants/types";
import { normalizeIngredientList, toIngredientSummary } from "@/lib/ingredients";

const STORAGE_KEY_ENTRIES = "nutrition_entries";

export const [AppProvider, useApp] = createContextHook(() => {
  const [entries, setEntries] = useState<FoodEntry[]>([]);

  const normalizeEntry = (entry: FoodEntry): FoodEntry => {
    const ingredients = normalizeIngredientList(entry.ingredients, entry.description);
    const hasCompletedData =
      ingredients.length > 0 ||
      (entry.nutrition?.calories ?? 0) > 0 ||
      Boolean(entry.aiAnalysis?.trim());
    const normalizedStatus =
      entry.analysisStatus ?? (hasCompletedData ? "completed" : "pending");
    return {
      ...entry,
      ingredients,
      analysisStatus: normalizedStatus,
      description:
        normalizedStatus === "pending"
          ? entry.description?.trim() || "Analyzing meal..."
          : entry.description?.trim().length > 0
            ? entry.description
            : toIngredientSummary(ingredients),
    };
  };

  const entriesQuery = useQuery({
    queryKey: ["entries"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ENTRIES);
      if (!stored) {
        return [];
      }

      const parsedEntries = JSON.parse(stored) as FoodEntry[];
      return parsedEntries.map(normalizeEntry);
    },
  });

  const saveEntriesMutation = useMutation({
    mutationFn: async (newEntries: FoodEntry[]) => {
      const normalizedEntries = newEntries.map(normalizeEntry);
      await AsyncStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(normalizedEntries));
      return normalizedEntries;
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
    setEntries((prev) => {
      const updated = [...prev, normalizeEntry(entry)];
      saveEntriesMutation.mutate(updated);
      return updated;
    });
  };

  const updateFoodEntry = (updatedEntry: FoodEntry) => {
    setEntries((prev) => {
      const updated = prev.map((entry) =>
        entry.id === updatedEntry.id ? normalizeEntry(updatedEntry) : entry
      );
      saveEntriesMutation.mutate(updated);
      return updated;
    });
  };

  const deleteFoodEntry = (entryId: string) => {
    setEntries((prev) => {
      const updated = prev.filter((entry) => entry.id !== entryId);
      saveEntriesMutation.mutate(updated);
      return updated;
    });
  };

  const getEntriesByDate = (date: Date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateTime = targetDate.getTime();

    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === targetDateTime;
      })
      .reverse();
  };

  const getTotalsByDate = (date: Date) => {
    const dateEntries = getEntriesByDate(date);
    return dateEntries.reduce(
      (acc, entry) => ({
        carbs: acc.carbs + entry.nutrition.carbs,
        protein: acc.protein + entry.nutrition.protein,
        fats: acc.fats + entry.nutrition.fats,
        calories: acc.calories + entry.nutrition.calories,
      }),
      { carbs: 0, protein: 0, fats: 0, calories: 0 }
    );
  };

  const getTodayEntries = () => getEntriesByDate(new Date());

  const getTodayTotals = () => getTotalsByDate(new Date());

  return {
    entries,
    isLoading: entriesQuery.isLoading,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    getEntriesByDate,
    getTotalsByDate,
    getTodayEntries,
    getTodayTotals,
  };
});
