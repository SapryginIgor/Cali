import { generateObject } from "@rork-ai/toolkit-sdk";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import Colors from "@/constants/colors";
import { FoodEntry } from "@/constants/types";
import { useApp } from "@/contexts/AppContext";
import { Image } from "expo-image";

const nutritionSchema = z.object({
  carbs: z.number().describe("Carbohydrates in grams"),
  protein: z.number().describe("Protein in grams"),
  fats: z.number().describe("Fats in grams"),
  calories: z.number().describe("Total calories"),
  analysis: z.string().describe("Brief analysis of the food"),
});

export default function TodayScreen() {
  const { profile, addFoodEntry, getTodayEntries, getTodayTotals } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const todayEntries = getTodayEntries();
  const totals = getTodayTotals();

  const analyzeFood = async (description: string, imageUri?: string) => {
    setIsAnalyzing(true);
    try {
      let messages: any[] = [];

      if (imageUri) {
        messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this food image and provide nutritional information. ${description ? `Additional context: ${description}` : ""}`,
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
            content: `Analyze this food description and provide nutritional information: ${description}`,
          },
        ];
      }

      console.log("Sending request to AI with messages:", JSON.stringify(messages, null, 2));

      const result = await generateObject({
        messages,
        schema: nutritionSchema,
      });

      console.log("AI response:", result);

      const entry: FoodEntry = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        description: description || "Photo",
        imageUri,
        nutrition: {
          carbs: result.carbs,
          protein: result.protein,
          fats: result.fats,
          calories: result.calories,
        },
        aiAnalysis: result.analysis,
      };

      addFoodEntry(entry);
      setModalVisible(false);
      setInputText("");
      setSelectedImage(null);
    } catch (error: any) {
      console.error("Error analyzing food:", error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      
      let errorMessage = "Failed to analyze food. Please try again.";
      if (error?.message) {
        if (error.message.includes("JSON")) {
          errorMessage = "AI service error. Please try again in a moment.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setModalVisible(true);
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to select photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!selectedImage) {
      Alert.alert("Photo required", "Please take a photo of your meal");
      return;
    }
    analyzeFood(inputText, selectedImage || undefined);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getProgressPercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F8FAFC", "#EEF2FF"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {profile && (
          <View style={styles.macrosCard}>
            <LinearGradient
              colors={["#FFFFFF", "#FEFEFE"]}
              style={styles.macrosCardGradient}
            >
            <Text style={styles.macrosTitle}>Daily Progress</Text>
            <View style={styles.macrosGrid}>
              <View style={styles.macroItem}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={styles.macroValue}>
                    {Math.round(totals.calories)}/{profile.dailyGoals.calories}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={["#8B5CF6", Colors.light.tint]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      {
                        width: `${getProgressPercentage(totals.calories, profile.dailyGoals.calories)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>
                    {Math.round(totals.protein)}g/{profile.dailyGoals.protein}g
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={["#60A5FA", "#3B82F6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      {
                        width: `${getProgressPercentage(totals.protein, profile.dailyGoals.protein)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={styles.macroValue}>
                    {Math.round(totals.carbs)}g/{profile.dailyGoals.carbs}g
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={["#FBBF24", "#F59E0B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      {
                        width: `${getProgressPercentage(totals.carbs, profile.dailyGoals.carbs)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>Fats</Text>
                  <Text style={styles.macroValue}>
                    {Math.round(totals.fats)}g/{profile.dailyGoals.fats}g
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={["#F87171", "#EF4444"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      {
                        width: `${getProgressPercentage(totals.fats, profile.dailyGoals.fats)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
            </LinearGradient>
          </View>
        )}

        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>Meals</Text>
          <Text style={styles.timelineCount}>{todayEntries.length}</Text>
        </View>

        {todayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>No meals logged yet</Text>
            <Text style={styles.emptySubtitle}>
              Start tracking by adding your first meal
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {todayEntries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                {entry.imageUri && (
                  <Image source={{ uri: entry.imageUri }} style={styles.entryImage} />
                )}
                <View style={styles.entryContent}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
                  </View>
                  <Text style={styles.entryDescription}>{entry.description}</Text>
                  {entry.aiAnalysis && (
                    <Text style={styles.entryAnalysis}>{entry.aiAnalysis}</Text>
                  )}
                  <View style={styles.entryNutrition}>
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionText}>
                        {Math.round(entry.nutrition.calories)} cal
                      </Text>
                    </View>
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionText}>P: {Math.round(entry.nutrition.protein)}g</Text>
                    </View>
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionText}>C: {Math.round(entry.nutrition.carbs)}g</Text>
                    </View>
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionText}>F: {Math.round(entry.nutrition.fats)}g</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </SafeAreaView>

      <View style={styles.logButtonContainer}>
        <TouchableOpacity
          style={styles.logButton}
          onPress={handleCamera}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={["#FFFFFF", "#F8FAFC"]}
            style={styles.logButtonGradient}
          >
            <View style={styles.logButtonInner}>
              <Plus color={Colors.light.accent1} size={56} strokeWidth={2.5} />
              <Text style={styles.logButtonText}>Log Meal</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setInputText("");
          setSelectedImage(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setInputText("");
                setSelectedImage(null);
              }}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log Meal</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={isAnalyzing}>
              <Text
                style={[
                  styles.modalDone,
                  isAnalyzing && styles.modalDoneDisabled,
                ]}
              >
                {isAnalyzing ? "..." : "Done"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add details about your meal (optional)"
                placeholderTextColor={Colors.light.secondaryText}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={200}
                editable={!isAnalyzing}
              />
            </View>

            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleCamera}
                disabled={isAnalyzing}
              >
                <Camera color={Colors.light.tint} size={24} />
                <Text style={styles.photoButtonText}>Retake Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleGallery}
                disabled={isAnalyzing}
              >
                <ImagePlus color={Colors.light.tint} size={24} />
                <Text style={styles.photoButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>

            {isAnalyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={Colors.light.tint} />
                <Text style={styles.analyzingText}>Analyzing nutrition...</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: Colors.light.background,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerDate: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  content: {
    flex: 1,
  },
  macrosCard: {
    margin: 20,
    borderRadius: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.08)",
  },
  macrosCardGradient: {
    padding: 24,
    borderRadius: 24,
  },
  macrosTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  macrosGrid: {
    gap: 16,
  },
  macroItem: {
    gap: 8,
  },
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  timelineCount: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.tertiaryText,
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: "center",
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  entryCard: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  entryImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#F1F5F9",
  },
  entryContent: {
    padding: 18,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  entryTime: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  entryDescription: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  entryAnalysis: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    lineHeight: 21,
    marginBottom: 14,
  },
  entryNutrition: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutritionBadge: {
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: Colors.light.accent1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.1)",
  },
  nutritionText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.accent1,
  },
  logButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
    pointerEvents: "box-none",
  },
  logButton: {
    width: "100%",
    height: 180,
    borderRadius: 32,
    shadowColor: Colors.light.accent1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 16,
  },
  logButtonGradient: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Colors.light.accent1,
  },
  logButtonInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  logButtonText: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.accent1,
    letterSpacing: -0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  modalDone: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.tint,
  },
  modalDoneDisabled: {
    color: Colors.light.secondaryText,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 240,
    backgroundColor: "#E5E7EB",
  },
  removeImageButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600" as const,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: Colors.light.lightBlue,
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "transparent",
  },
  photoButtons: {
    flexDirection: "row",
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 14,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: Colors.light.text,
  },
  analyzingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  analyzingText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
});
