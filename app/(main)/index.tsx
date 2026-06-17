import { generateObject, editLogWithAI } from "@/lib/ai";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowUp,
  Camera,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import TrialBanner from "@/components/TrialBanner";
import Colors from "@/constants/colors";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { FoodEntry, IngredientItem } from "@/constants/types";
import { useApp } from "@/contexts/AppContext";
import { Image } from "expo-image";
import {
  createEmptyIngredient,
  isIngredientListValid,
  normalizeIngredientList,
  toIngredientSummary,
} from "@/lib/ingredients";
import { getFoodEmoji } from "@/lib/foodEmoji";

const nutritionSchema = z.object({
  carbs: z.number().describe("Carbohydrates in grams"),
  protein: z.number().describe("Protein in grams"),
  fats: z.number().describe("Fats in grams"),
  calories: z.number().describe("Total calories"),
  analysis: z.string().describe("Brief analysis of the food"),
  logName: z.string().describe("AI-suggested short title for the meal log"),
  ingredients: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        quantity: z.string(),
        carbs: z.number(),
        fats: z.number(),
        proteins: z.number(),
        calories: z.number(),
        sources: z.array(z.string()).optional(),
        unit: z.string().optional(),
        preparation: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .describe("Structured list of meal ingredients"),
  mealNotes: z.string().optional().describe("Optional short notes about the meal"),
});

const WEEKS_BEFORE = 104;
const WEEKS_AFTER = 104;
const INITIAL_WEEK_INDEX = WEEKS_BEFORE;

const normalizeDate = (date: Date) => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
};

const startOfWeekSunday = (date: Date) => {
  const normalizedDate = normalizeDate(date);
  const weekStart = new Date(normalizedDate);
  weekStart.setDate(normalizedDate.getDate() - normalizedDate.getDay());
  return weekStart;
};

const buildWeekDays = (weekStartDate: Date) => {
  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + i);
    days.push(date);
  }
  return days;
};

const buildCalendarWeeks = (centerDate: Date, weeksBefore: number, weeksAfter: number) => {
  const centerWeekStart = startOfWeekSunday(centerDate);
  const weekStarts: Date[] = [];

  for (let weekOffset = -weeksBefore; weekOffset <= weeksAfter; weekOffset += 1) {
    const weekStart = new Date(centerWeekStart);
    weekStart.setDate(centerWeekStart.getDate() + weekOffset * 7);
    weekStarts.push(weekStart);
  }

  return weekStarts;
};

const formatCalendarWeekday = (date: Date) =>
  date
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 2)
    .toUpperCase();

const isSameDay = (firstDate: Date, secondDate: Date) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

type CalendarCarouselProps = {
  calendarWeeks: Date[];
  selectedDate: Date;
  todayDate: Date;
  onSelectDate: (date: Date) => void;
  screenWidth: number;
};

const CalendarCarousel = memo(
  ({ calendarWeeks, selectedDate, todayDate, onSelectDate, screenWidth }: CalendarCarouselProps) => {
    const renderCalendarDay = useCallback(
      (date: Date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isToday = isSameDay(date, todayDate);
        const isTodayUnselected = isToday && !isSelected;
        const isFuture = date.getTime() > todayDate.getTime();

        return (
          <TouchableOpacity
            style={[styles.calendarDayItem, isFuture && styles.calendarDayItemFuture]}
            onPress={() => onSelectDate(date)}
            disabled={isFuture}
            activeOpacity={0.8}
          >
            <View style={styles.calendarWeekdayContainer}>
              <Text
                style={[
                  styles.calendarDayWeekday,
                  isFuture && styles.calendarDayWeekdayFuture,
                  isSelected && styles.calendarDayWeekdaySelected,
                ]}
              >
                {formatCalendarWeekday(date)}
              </Text>
            </View>
            <View
              style={[
                styles.calendarDayCircle,
                isTodayUnselected && styles.calendarDayCircleToday,
                isSelected && styles.calendarDayCircleSelected,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayNumber,
                  isFuture && styles.calendarDayNumberFuture,
                  isSelected && styles.calendarDayNumberSelected,
                ]}
              >
                {date.getDate()}
              </Text>
            </View>
          </TouchableOpacity>
        );
      },
      [onSelectDate, selectedDate, todayDate]
    );

    const renderCalendarWeek = useCallback(
      ({ item }: { item: Date }) => {
        const weekDays = buildWeekDays(item);
        return (
          <View style={[styles.calendarWeekPage, { width: screenWidth }]}>
            {weekDays.map((date) => (
              <View key={date.toISOString()} style={styles.calendarWeekDaySlot}>
                {renderCalendarDay(date)}
              </View>
            ))}
          </View>
        );
      },
      [renderCalendarDay, screenWidth]
    );

    return (
      <FlatList
        horizontal
        data={calendarWeeks}
        initialScrollIndex={INITIAL_WEEK_INDEX}
        keyExtractor={(item) => item.toISOString()}
        renderItem={renderCalendarWeek}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        extraData={selectedDate.getTime()}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
      />
    );
  }
);

export default function TodayScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  const {
    entries,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    getEntriesByDate,
    getTotalsByDate,
  } = useApp();
  const { isPremium, presentPaywall } = useSubscription();
  const todayDate = useMemo(() => normalizeDate(new Date()), []);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editIngredients, setEditIngredients] = useState<IngredientItem[]>([]);
  const [editAICorrection, setEditAICorrection] = useState("");
  const [editAILoading, setEditAILoading] = useState(false);
  const [editKeyboardHeight, setEditKeyboardHeight] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(todayDate, WEEKS_BEFORE, WEEKS_AFTER),
    [todayDate]
  );
  const displayedEntries = getEntriesByDate(selectedDate);
  const totals = getTotalsByDate(selectedDate);
  const pendingEntryIdsRef = useRef<Set<string>>(new Set());
  const cameraRef = useRef<CameraView>(null);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
const getAnalysisMessages = useCallback((description: string, imageUri?: string) => {
    let messages: any[] = [];
    if (imageUri) {
      messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this meal image and return ONLY JSON with fields: carbs (number), protein (number), fats (number), calories (number), analysis (string), logName (string), ingredients (array of {id, name, quantity, carbs, fats, proteins, calories, sources?, unit?, preparation?, note?}), and optional mealNotes (string). Include one ingredient item per meal component. Name, quantity, carbs, fats, proteins, and calories are required for every ingredient. logName must be a short human-friendly title for the log." +
                (description ? ` Additional context: ${description}` : ""),
            },
            {
              type: "image",
              image: imageUri,
            },
          ],
        },
      ];
    } else {
      messages = [
        {
          role: "user",
          content:
            "Analyze this meal description and return ONLY JSON with fields: carbs, protein, fats, calories, analysis, logName, ingredients (array with id, name, quantity, carbs, fats, proteins, calories, optional sources), and optional mealNotes. logName must be a short human-friendly title for the log. " +
            `Description: ${description}`,
        },
      ];
    }
    return messages;
  }, []);

  const processPendingEntry = useCallback(async (entryId: string, description: string, imageUri?: string) => {
    if (pendingEntryIdsRef.current.has(entryId)) {
      return;
    }
    pendingEntryIdsRef.current.add(entryId);
    try {
      const messages = getAnalysisMessages(description, imageUri);
      console.log("Sending request to AI with messages:", JSON.stringify(messages, null, 2));
      const result = await generateObject<z.infer<typeof nutritionSchema>>({
        messages,
        schema: nutritionSchema,
      });
      console.log("AI response:", result);
      const normalizedIngredients = normalizeIngredientList(
        result.ingredients,
        description.trim() || undefined
      );
      const aiLogName = result.logName?.trim() || "Meal";
      const existingEntry = entries.find((entry) => entry.id === entryId);
      if (!existingEntry) {
        return;
      }

      updateFoodEntry({
        ...existingEntry,
        description: aiLogName,
        pendingDescription: description.trim() || undefined,
        mealNotes: result.mealNotes,
        ingredients: normalizedIngredients,
        analysisStatus: "completed",
        analysisError: undefined,
        nutrition: {
          carbs: result.carbs,
          protein: result.protein,
          fats: result.fats,
          calories: result.calories,
        },
        aiAnalysis: result.analysis,
      });
    } catch (error: any) {
      console.error("Error analyzing food:", error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      const existingEntry = entries.find((entry) => entry.id === entryId);
      if (!existingEntry) {
        return;
      }
      updateFoodEntry({
        ...existingEntry,
        description: "Analysis failed",
        pendingDescription: description.trim() || undefined,
        analysisStatus: "failed",
        analysisError: error?.message || "Failed to analyze food",
        aiAnalysis: "We could not analyze this meal. You can try logging it again.",
      });
    } finally {
      pendingEntryIdsRef.current.delete(entryId);
    }
  }, [entries, getAnalysisMessages, updateFoodEntry]);

  const submitEntry = useCallback((imageUri: string | null, text: string) => {
    const pendingId = Date.now().toString();
    const now = new Date();
    const entryDate = new Date(selectedDate);
    entryDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const pendingDescription = text.trim();

    addFoodEntry({
      id: pendingId,
      timestamp: entryDate.getTime(),
      description: "Analyzing meal...",
      pendingDescription: pendingDescription || undefined,
      ingredients: [],
      imageUri: imageUri ?? undefined,
      analysisStatus: "pending",
      nutrition: { carbs: 0, protein: 0, fats: 0, calories: 0 },
    });
  }, [selectedDate, addFoodEntry]);

  const handleOpenLogMeal = useCallback(async () => {
    if (!isPremium) {
      presentPaywall();
      return;
    }
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert("Permission needed", "Camera access is required to take photos");
        return;
      }
    }
    setModalVisible(true);
  }, [isPremium, presentPaywall, cameraPermission, requestCameraPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) {
        submitEntry(photo.uri, inputText);
        setInputText("");
        setModalVisible(false);
      }
    } catch (error) {
      console.error("Failed to capture photo:", error);
    }
  }, [inputText, submitEntry]);

  const handleFlipCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === "back" ? "front" : "back"));
  }, []);

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to select photos");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      submitEntry(result.assets[0].uri, inputText);
      setInputText("");
      setModalVisible(false);
    }
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    submitEntry(selectedImage, inputText);
    setInputText("");
    setSelectedImage(null);
    setIsSubmitting(false);
  };

  useEffect(() => {
    entries
      .filter((entry) => entry.analysisStatus === "pending" && (entry.imageUri || entry.pendingDescription))
      .forEach((entry) => {
        void processPendingEntry(entry.id, entry.pendingDescription || "", entry.imageUri);
      });
  }, [entries, processPendingEntry]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        return;
      }
      entries
        .filter((entry) => entry.analysisStatus === "pending" && (entry.imageUri || entry.pendingDescription))
        .forEach((entry) => {
          void processPendingEntry(entry.id, entry.pendingDescription || "", entry.imageUri);
        });
    });
    return () => subscription.remove();
  }, [entries, processPendingEntry]);

  useEffect(() => {
    if (!editModalVisible) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setEditKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setEditKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [editModalVisible]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleSelectCalendarDay = useCallback((date: Date) => {
    const normalizedDate = normalizeDate(date);
    if (normalizedDate.getTime() > todayDate.getTime()) {
      return;
    }
    if (!isSameDay(normalizedDate, selectedDate)) {
      setSelectedDate(normalizedDate);
    }
  }, [selectedDate, todayDate]);

  const resetEditState = () => {
    setEditModalVisible(false);
    setEditingEntryId(null);
    setEditDescription("");
    setEditIngredients([]);
    setEditAICorrection("");
    setEditAILoading(false);
  };

  const handleEditEntry = (entry: FoodEntry) => {
    setEditingEntryId(entry.id);
    setEditDescription(entry.description);
    setEditIngredients(normalizeIngredientList(entry.ingredients, entry.description));
    setEditModalVisible(true);
  };

  const handleAddIngredient = () => {
    setEditIngredients((prev) => [...prev, createEmptyIngredient()]);
  };

  const handleUpdateIngredient = (ingredientId: string, field: "name" | "quantity", value: string) => {
    setEditIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.id === ingredientId
          ? {
              ...ingredient,
              [field]: value,
            }
          : ingredient
      )
    );
  };

  const handleUpdateIngredientMacro = (
    ingredientId: string,
    field: "carbs" | "fats" | "proteins",
    value: string
  ) => {
    const trimmed = value.trim();
    const parsed = trimmed.length === 0 ? 0 : Number(trimmed);
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setEditIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.id === ingredientId
          ? (() => {
              const updated = {
                ...ingredient,
                [field]: safeValue,
              };
              const calories = updated.carbs * 4 + updated.proteins * 4 + updated.fats * 9;
              return { ...updated, calories: Math.round(calories * 10) / 10 };
            })()
          : ingredient
      )
    );
  };

  const handleRemoveIngredient = (ingredientId: string) => {
    setEditIngredients((prev) => prev.filter((ingredient) => ingredient.id !== ingredientId));
  };

  const handleAIEditSubmit = async () => {
    const correction = editAICorrection.trim();
    if (!correction || editAILoading) return;

    setEditAILoading(true);
    try {
      const editingEntry = entries.find((entry) => entry.id === editingEntryId);
      const result = await editLogWithAI(
        editIngredients,
        correction,
        editingEntry?.imageUri
      );
      setEditIngredients(result.ingredients);
      if (result.logName) setEditDescription(result.logName);
      setEditAICorrection("");
    } catch (error) {
      Alert.alert(
        "AI Edit Failed",
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setEditAILoading(false);
    }
  };

  const handleSaveEditedEntry = () => {
    if (!editingEntryId) {
      return;
    }

    const existingEntry = displayedEntries.find((entry) => entry.id === editingEntryId);
    if (!existingEntry) {
      Alert.alert("Error", "Could not find this entry to update.");
      return;
    }

    const normalizedIngredients = normalizeIngredientList(editIngredients, editDescription);
    if (!isIngredientListValid(normalizedIngredients)) {
      Alert.alert(
        "Invalid ingredients",
        "Please add at least one ingredient and fill in name + quantity for each ingredient."
      );
      return;
    }

    const protein = normalizedIngredients.reduce((sum, i) => sum + i.proteins, 0);
    const carbs = normalizedIngredients.reduce((sum, i) => sum + i.carbs, 0);
    const fats = normalizedIngredients.reduce((sum, i) => sum + i.fats, 0);
    const calories = normalizedIngredients.reduce((sum, i) => sum + i.calories, 0);

    updateFoodEntry({
      ...existingEntry,
      description: editDescription.trim() || toIngredientSummary(normalizedIngredients),
      ingredients: normalizedIngredients,
      nutrition: {
        carbs: Math.round(carbs * 10) / 10,
        protein: Math.round(protein * 10) / 10,
        fats: Math.round(fats * 10) / 10,
        calories: Math.round(calories),
      },
    });
    resetEditState();
  };

  const handleDeleteEntry = (entry: FoodEntry) => {
    Alert.alert(
      "Delete meal log",
      "Are you sure you want to permanently delete this meal log?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteFoodEntry(entry.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFFFF", "#FFF7ED", "#FFEDD5"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <TrialBanner />
        <View style={styles.calendarContainer}>
          <View style={styles.calendarTopRow}>
            <View style={styles.calendarTopRowSpacer} />
            <TouchableOpacity
              onPress={() => router.push("/(main)/profile" as never)}
              style={styles.headerProfileButton}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <User size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
          <CalendarCarousel
            calendarWeeks={calendarWeeks}
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelectDate={handleSelectCalendarDay}
            screenWidth={screenWidth}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.macrosCard}>
            <LinearGradient
              colors={["#FFFFFF", "#FFFBF7"]}
              style={styles.macrosCardGradient}
            >
              <View style={styles.macrosHeader}>
                <Text style={styles.macrosTitle}>Daily Intake</Text>
                <Text style={styles.macrosSubtitle}>
                  {displayedEntries.length} {displayedEntries.length === 1 ? "meal" : "meals"} logged
                </Text>
              </View>

              <View style={styles.macrosGrid}>
                {/* Calories - Large Card */}
                <View style={styles.macroCardLarge}>
                  <LinearGradient
                    colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.macroCardLargeGradient}
                  >
                    <Text style={styles.macroCardLargeLabel}>Calories</Text>
                    <Text style={styles.macroCardLargeValue}>
                      {Math.round(totals.calories)}
                    </Text>
                    <Text style={styles.macroCardLargeGoal}>cal</Text>
                  </LinearGradient>
                </View>

                {/* Macros Grid */}
                <View style={styles.macrosRow}>
                  <View style={styles.macroCard}>
                    <View style={styles.macroCardHeader}>
                      <View style={[styles.macroDot, { backgroundColor: Colors.light.macroProtein }]} />
                      <Text style={styles.macroCardLabel}>Protein</Text>
                    </View>
                    <Text style={styles.macroCardValue}>
                      {Math.round(totals.protein)}g
                    </Text>
                  </View>

                  <View style={styles.macroCard}>
                    <View style={styles.macroCardHeader}>
                      <View style={[styles.macroDot, { backgroundColor: Colors.light.macroCarbs }]} />
                      <Text style={styles.macroCardLabel}>Carbs</Text>
                    </View>
                    <Text style={styles.macroCardValue}>
                      {Math.round(totals.carbs)}g
                    </Text>
                  </View>
                </View>

                <View style={styles.macroCard}>
                  <View style={styles.macroCardHeader}>
                    <View style={[styles.macroDot, { backgroundColor: Colors.light.macroFats }]} />
                    <Text style={styles.macroCardLabel}>Fats</Text>
                  </View>
                  <Text style={styles.macroCardValue}>
                    {Math.round(totals.fats)}g
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>Meals</Text>
            <View style={styles.timelineBadge}>
              <Text style={styles.timelineCount}>{displayedEntries.length}</Text>
            </View>
          </View>

          {displayedEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🍽️</Text>
              </View>
              <Text style={styles.emptyTitle}>No meals logged yet</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking by adding your first meal with AI-powered analysis
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {displayedEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <LinearGradient
                    colors={["#FFFFFF", "#FAFBFF"]}
                    style={styles.entryCardGradient}
                  >
                    <View style={styles.entryContent}>
                      <View style={styles.entryHeader}>
                        <View style={styles.entryHeaderLeft}>
                          <View style={styles.entryTimeBadge}>
                            <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
                          </View>
                          {entry.analysisStatus === "pending" && (
                            <View style={styles.entryPendingBadge}>
                              <Text style={styles.entryPendingBadgeText}>Pending</Text>
                            </View>
                          )}
                          {entry.analysisStatus === "failed" && (
                            <View style={styles.entryFailedBadge}>
                              <Text style={styles.entryFailedBadgeText}>Failed</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.entryHeaderRight}>
                          <View style={styles.entryCaloriesBadge}>
                            <Text style={styles.entryCalories}>
                              {Math.round(entry.nutrition.calories)} cal
                            </Text>
                          </View>
                          <View style={styles.entryActions}>
                            <TouchableOpacity
                              style={styles.entryActionButton}
                              onPress={() => handleEditEntry(entry)}
                              disabled={entry.analysisStatus === "pending"}
                              accessibilityRole="button"
                              accessibilityLabel="Edit meal log"
                            >
                              <Pencil size={16} color={Colors.light.accent1} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.entryActionButton}
                              onPress={() => handleDeleteEntry(entry)}
                              accessibilityRole="button"
                              accessibilityLabel="Delete meal log"
                            >
                              <Trash2 size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {entry.imageUri ? (
                        <View style={styles.entryImageContainer}>
                          <Image
                            source={{ uri: entry.imageUri }}
                            style={styles.entryImage}
                            contentFit="cover"
                          />
                        </View>
                      ) : entry.analysisStatus !== "pending" && (
                        <View style={styles.entryEmojiContainer}>
                          <Text style={styles.entryEmojiLarge}>{getFoodEmoji(entry.description)}</Text>
                        </View>
                      )}

                      <Text style={styles.entryDescription}>{entry.description}</Text>

                      {entry.analysisStatus !== "pending" && entry.ingredients.length > 0 && (
                        <View style={styles.ingredientsList}>
                          {entry.ingredients.map((ingredient) => (
                            <View key={ingredient.id} style={styles.ingredientChip}>
                              <Text style={styles.ingredientChipText}>
                                {ingredient.quantity} {ingredient.unit ? `${ingredient.unit} ` : ""}
                                {ingredient.name}
                              </Text>
                              <Text style={styles.ingredientChipMacroText}>
                                C {Math.round(ingredient.carbs)}g  F {Math.round(ingredient.fats)}g  P{" "}
                                {Math.round(ingredient.proteins)}g  |  {Math.round(ingredient.calories)} kcal
                              </Text>
                              {ingredient.sources && ingredient.sources.length > 0 && (
                                <Text style={styles.ingredientChipSourcesText}>
                                  Sources: {ingredient.sources.join(", ")}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {entry.analysisStatus === "pending" && (
                        <View style={styles.entryAnalysisContainer}>
                          <Sparkles size={14} color={Colors.light.accent1} />
                          <Text style={styles.entryAnalysis}>
                            Your meal is being analyzed in the background.
                          </Text>
                        </View>
                      )}

                      {entry.analysisStatus !== "pending" && entry.aiAnalysis && (
                        <View style={styles.entryAnalysisContainer}>
                          <Sparkles size={14} color={Colors.light.accent1} />
                          <Text style={styles.entryAnalysis}>{entry.aiAnalysis}</Text>
                        </View>
                      )}

                      <View style={styles.entryNutrition}>
                        <View style={[styles.nutritionBadge, { backgroundColor: `${Colors.light.macroProtein}15` }]}>
                          <Text style={[styles.nutritionText, { color: Colors.light.macroProtein }]}>
                            P: {Math.round(entry.nutrition.protein)}g
                          </Text>
                        </View>
                        <View style={[styles.nutritionBadge, { backgroundColor: `${Colors.light.macroCarbs}15` }]}>
                          <Text style={[styles.nutritionText, { color: Colors.light.macroCarbs }]}>
                            C: {Math.round(entry.nutrition.carbs)}g
                          </Text>
                        </View>
                        <View style={[styles.nutritionBadge, { backgroundColor: `${Colors.light.macroFats}15` }]}>
                          <Text style={[styles.nutritionText, { color: Colors.light.macroFats }]}>
                            F: {Math.round(entry.nutrition.fats)}g
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetEditState}
      >
        <SafeAreaView style={styles.modalContainer}>
          <LinearGradient
            colors={["#FFFFFF", "#F8FAFF"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetEditState}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Meal</Text>
            <TouchableOpacity onPress={handleSaveEditedEntry}>
              <Text style={styles.modalDone}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.editDescriptionInput]}
                placeholder="Meal description"
                placeholderTextColor={Colors.light.secondaryText}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.ingredientEditorHeader}>
              <Text style={styles.inputLabel}>Ingredients</Text>
              <TouchableOpacity style={styles.addIngredientButton} onPress={handleAddIngredient}>
                <Plus size={14} color={Colors.light.tint} />
                <Text style={styles.addIngredientButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {editIngredients.map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientEditorRow}>
                <View style={styles.ingredientEditorTopRow}>
                  <TextInput
                    style={[styles.editNutritionInput, styles.ingredientNameInput]}
                    value={ingredient.name}
                    onChangeText={(value) => handleUpdateIngredient(ingredient.id, "name", value)}
                    placeholder="Ingredient name"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                  <TextInput
                    style={[styles.editNutritionInput, styles.ingredientQuantityInput]}
                    value={ingredient.quantity}
                    onChangeText={(value) => handleUpdateIngredient(ingredient.id, "quantity", value)}
                    placeholder="Quantity"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                  <TouchableOpacity
                    style={styles.removeIngredientButton}
                    onPress={() => handleRemoveIngredient(ingredient.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove ingredient"
                  >
                    <Trash2 size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
                <View style={styles.ingredientMacroRow}>
                  <TextInput
                    style={[styles.editNutritionInput, styles.ingredientMacroInput]}
                    value={ingredient.carbs.toString()}
                    onChangeText={(value) => handleUpdateIngredientMacro(ingredient.id, "carbs", value)}
                    keyboardType="decimal-pad"
                    placeholder="Carbs (g)"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                  <TextInput
                    style={[styles.editNutritionInput, styles.ingredientMacroInput]}
                    value={ingredient.fats.toString()}
                    onChangeText={(value) => handleUpdateIngredientMacro(ingredient.id, "fats", value)}
                    keyboardType="decimal-pad"
                    placeholder="Fats (g)"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                  <TextInput
                    style={[styles.editNutritionInput, styles.ingredientMacroInput]}
                    value={ingredient.proteins.toString()}
                    onChangeText={(value) => handleUpdateIngredientMacro(ingredient.id, "proteins", value)}
                    keyboardType="decimal-pad"
                    placeholder="Proteins (g)"
                    placeholderTextColor={Colors.light.secondaryText}
                  />
                </View>
                <Text style={styles.ingredientCaloriesText}>
                  Ingredient calories: {Math.round(ingredient.calories)} kcal
                </Text>
                {ingredient.sources && ingredient.sources.length > 0 && (
                  <Text style={styles.ingredientSourcesText}>
                    Sources: {ingredient.sources.join(", ")}
                  </Text>
                )}
              </View>
            ))}

            <View style={styles.editNutritionGrid}>
              <View style={styles.editNutritionField}>
                <Text style={styles.inputLabel}>Protein</Text>
                <Text style={styles.editNutritionValue}>
                  {Math.round(editIngredients.reduce((s, i) => s + i.proteins, 0) * 10) / 10}g
                </Text>
              </View>
              <View style={styles.editNutritionField}>
                <Text style={styles.inputLabel}>Carbs</Text>
                <Text style={styles.editNutritionValue}>
                  {Math.round(editIngredients.reduce((s, i) => s + i.carbs, 0) * 10) / 10}g
                </Text>
              </View>
              <View style={styles.editNutritionField}>
                <Text style={styles.inputLabel}>Fats</Text>
                <Text style={styles.editNutritionValue}>
                  {Math.round(editIngredients.reduce((s, i) => s + i.fats, 0) * 10) / 10}g
                </Text>
              </View>
              <View style={styles.editNutritionField}>
                <Text style={styles.inputLabel}>Calories</Text>
                <Text style={styles.editNutritionValue}>
                  {Math.round(editIngredients.reduce((s, i) => s + i.calories, 0))}
                </Text>
              </View>
            </View>

          </ScrollView>

          <View style={[styles.aiEditBar, editKeyboardHeight > 0 && { paddingBottom: editKeyboardHeight - 20 }]}>
            <TextInput
              style={styles.aiEditInput}
              placeholder="What to change?"
              placeholderTextColor={Colors.light.secondaryText}
              value={editAICorrection}
              onChangeText={setEditAICorrection}
              editable={!editAILoading}
              returnKeyType="send"
              onSubmitEditing={handleAIEditSubmit}
            />
            <TouchableOpacity
              style={[
                styles.aiEditSendButton,
                (!editAICorrection.trim() || editAILoading) && styles.aiEditSendButtonDisabled,
              ]}
              onPress={handleAIEditSubmit}
              disabled={!editAICorrection.trim() || editAILoading}
            >
              {editAILoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setModalVisible(false);
          setInputText("");
          setSelectedImage(null);
        }}
      >
        <View style={styles.confirmContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.confirmImageArea}>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={cameraFacing}
                />

                <View style={[styles.confirmTopBar, { paddingTop: safeInsets.top + 12 }]}>
                  <View style={styles.cameraTopRow}>
                    <TouchableOpacity
                      style={styles.confirmCloseButton}
                      onPress={() => setModalVisible(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                    >
                      <X color="#FFFFFF" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmCloseButton}
                      onPress={handleFlipCamera}
                      accessibilityRole="button"
                      accessibilityLabel="Flip camera"
                    >
                      <RefreshCw color="#FFFFFF" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.shutterContainer}>
                  <TouchableOpacity
                    style={styles.shutterButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleCapture();
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                  >
                    <View style={styles.shutterInner} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>

            <SafeAreaView edges={["bottom"]} style={styles.captionBarSafe}>
              <View style={styles.captionBar}>
                <TouchableOpacity
                  style={styles.captionBarAction}
                  onPress={handleGallery}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from gallery"
                >
                  <ImagePlus color="#FFFFFF" size={20} />
                </TouchableOpacity>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={200}
                />
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inputBarWrapper}
      >
        <View style={styles.inputBar}>
          {selectedImage && (
            <View style={styles.inputBarThumb}>
              <Image source={{ uri: selectedImage }} style={styles.inputBarThumbImage} contentFit="cover" />
              <TouchableOpacity
                style={styles.inputBarThumbRemove}
                onPress={() => setSelectedImage(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <X color="#FFFFFF" size={10} />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={styles.inputBarInput}
            placeholder="What did you eat?"
            placeholderTextColor={Colors.light.secondaryText}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
            editable={!isSubmitting}
          />
          {(inputText.trim().length > 0 || selectedImage !== null) && (
            <TouchableOpacity
              style={[styles.inputBarSend, isSubmitting && styles.sendButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Log meal"
            >
              <ArrowUp color="#FFFFFF" size={22} strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.inputBarCameraBtn}
          onPress={handleOpenLogMeal}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
        >
          <LinearGradient
            colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inputBarCameraBtnGradient}
          >
            <Camera color="#FFFFFF" size={40} />
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ height: safeInsets.bottom }} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  calendarTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  calendarTopRowSpacer: {
    flex: 1,
  },
  headerProfileButton: {
    padding: 6,
    marginRight: 18,
  },
  content: {
    flex: 1,
  },
  calendarContainer: {
    marginBottom: 18,
    paddingBottom: 4,
  },
  calendarWeekPage: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 6,
  },
  calendarWeekDaySlot: {
    flex: 1,
    alignItems: "center",
  },
  calendarDayItem: {
    width: "100%",
    alignItems: "center",
    gap: 6,
    paddingBottom: 2,
  },
  calendarDayItemFuture: {
    opacity: 0.4,
  },
  calendarWeekdayContainer: {
    minHeight: 18,
    justifyContent: "center",
  },
  calendarDayWeekday: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.secondaryText,
    letterSpacing: 0.2,
  },
  calendarDayWeekdayFuture: {
    color: `${Colors.light.secondaryText}99`,
  },
  calendarDayWeekdaySelected: {
    color: Colors.light.text,
    fontWeight: "800" as const,
  },
  calendarDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 24, 39, 0.04)",
  },
  calendarDayCircleSelected: {
    backgroundColor: Colors.light.text,
  },
  calendarDayCircleToday: {
    backgroundColor: "rgba(17, 24, 39, 0.1)",
  },
  calendarDayNumber: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  calendarDayNumberFuture: {
    color: `${Colors.light.text}99`,
  },
  calendarDayNumberSelected: {
    color: "#FFFFFF",
  },
  macrosCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 28,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.08)",
    overflow: "hidden",
  },
  macrosCardGradient: {
    padding: 24,
  },
  macrosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  macrosTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  macrosSubtitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.secondaryText,
  },
  macrosGrid: {
    gap: 16,
  },
  macroCardLarge: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: Colors.light.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  macroCardLargeGradient: {
    padding: 24,
  },
  macroCardLargeLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  macroCardLargeValue: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  macroCardLargeGoal: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 16,
  },
  macroCardLargeProgress: {
    marginTop: 8,
  },
  macroCardLargeProgressBar: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  macroCardLargeProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  macrosRow: {
    flexDirection: "row",
    gap: 12,
  },
  macroCard: {
    flex: 1,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  macroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroCardLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.secondaryText,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  macroCardValue: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  macroCardGoal: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.light.secondaryText,
    marginBottom: 12,
  },
  macroCardProgress: {
    marginTop: 4,
  },
  macroCardProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  macroCardProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  timelineBadge: {
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}20`,
  },
  timelineCount: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.light.accent1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "center",
    lineHeight: 22,
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  entryCard: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  entryCardGradient: {
    padding: 20,
  },
  entryContent: {
    gap: 12,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryTimeBadge: {
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  entryTime: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.accent1,
  },
  entryPendingBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  entryPendingBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#92400E",
  },
  entryFailedBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  entryFailedBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#B91C1C",
  },
  entryCaloriesBadge: {
    backgroundColor: Colors.light.gradientStart,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  entryCalories: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
  },
  entryActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.lightBlue,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  entryImageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginVertical: 4,
  },
  entryImage: {
    width: "100%",
    height: 200,
    backgroundColor: Colors.light.border,
  },
  entryEmojiContainer: {
    height: 120,
    borderRadius: 16,
    backgroundColor: Colors.light.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  entryEmojiLarge: {
    fontSize: 56,
  },
  entryDescription: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  ingredientsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientChip: {
    backgroundColor: Colors.light.lightBlue,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ingredientChipText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "600" as const,
  },
  ingredientChipMacroText: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  ingredientChipSourcesText: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.light.secondaryText,
    fontStyle: "italic" as const,
  },
  entryAnalysisContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.light.lightBlue,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}15`,
  },
  entryAnalysis: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  entryNutrition: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  nutritionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  nutritionText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  inputBarWrapper: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  inputBarCameraBtn: {
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 0,
    width: 90,
    height: 90,
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: Colors.light.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  inputBarCameraBtnGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    minHeight: 60,
  },
  inputBarInput: {
    flex: 1,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 18,
    color: Colors.light.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputBarSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBarThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "visible",
  },
  inputBarThumbImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  inputBarThumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.text,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBtn: {
    position: "absolute",
    left: 32,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  modalDone: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.light.tint,
  },
  modalDoneDisabled: {
    color: Colors.light.secondaryText,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  confirmContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  confirmImageArea: {
    flex: 1,
    position: "relative",
  },
  confirmTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  cameraTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  confirmCloseButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  editDescriptionInput: {
    minHeight: 100,
  },
  editNutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ingredientEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addIngredientButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.lightBlue,
    borderColor: Colors.light.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addIngredientButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.tint,
  },
  ingredientEditorRow: {
    gap: 8,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 10,
  },
  ingredientEditorTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ingredientMacroRow: {
    flexDirection: "row",
    gap: 8,
  },
  ingredientCaloriesText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontWeight: "600" as const,
  },
  ingredientSourcesText: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.light.secondaryText,
    fontStyle: "italic" as const,
  },
  ingredientNameInput: {
    flex: 1.3,
  },
  ingredientQuantityInput: {
    flex: 1,
  },
  ingredientMacroInput: {
    flex: 1,
  },
  removeIngredientButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  editNutritionField: {
    width: "48%",
  },
  editNutritionInput: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  editNutritionValue: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  aiEditBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  aiEditInput: {
    flex: 1,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  aiEditSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  aiEditSendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  captionBarWrapper: {
    backgroundColor: "#1A1A1A",
  },
  captionBarSafe: {
    backgroundColor: "#1A1A1A",
  },
  captionBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  captionBarAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  captionInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#FFFFFF",
    maxHeight: 100,
  },
});
