import { generateObject } from "@/lib/ai";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Plus, Sparkles } from "lucide-react-native";
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
  const { addFoodEntry, getTodayEntries, getTodayTotals } = useApp();
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

      const result = await generateObject<z.infer<typeof nutritionSchema>>({
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
      allowsEditing: false,
      quality: 1,
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
      allowsEditing: false,
      quality: 1,
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFFFF", "#FFF7ED", "#FFEDD5"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Modern Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Today</Text>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.headerBadge}>
            <Sparkles size={16} color={Colors.light.accent1} />
            <Text style={styles.headerBadgeText}>AI Powered</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.macrosCard}>
            <LinearGradient
              colors={["#FFFFFF", "#FFFBF7"]}
              style={styles.macrosCardGradient}
            >
              <View style={styles.macrosHeader}>
                <Text style={styles.macrosTitle}>Today's Intake</Text>
                <Text style={styles.macrosSubtitle}>
                  {todayEntries.length} {todayEntries.length === 1 ? "meal" : "meals"} logged
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
              <Text style={styles.timelineCount}>{todayEntries.length}</Text>
            </View>
          </View>

          {todayEntries.length === 0 ? (
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
              {todayEntries.map((entry) => (
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
                        </View>
                        <View style={styles.entryCaloriesBadge}>
                          <Text style={styles.entryCalories}>
                            {Math.round(entry.nutrition.calories)} cal
                          </Text>
                        </View>
                      </View>

                      {entry.imageUri && (
                        <View style={styles.entryImageContainer}>
                          <Image
                            source={{ uri: entry.imageUri }}
                            style={styles.entryImage}
                            resizeMode="cover"
                          />
                        </View>
                      )}

                      <Text style={styles.entryDescription}>{entry.description}</Text>

                      {entry.aiAnalysis && (
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

      {/* Circular Floating Action Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCamera}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Plus color="#FFFFFF" size={40} strokeWidth={3} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Enhanced Modal */}
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
          <LinearGradient
            colors={["#FFFFFF", "#F8FAFF"]}
            style={StyleSheet.absoluteFill}
          />
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

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.inputLabel}>Add details (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe your meal..."
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
                style={[styles.photoButton, styles.photoButtonLeft]}
                onPress={handleCamera}
                disabled={isAnalyzing}
              >
                <LinearGradient
                  colors={[Colors.light.lightBlue, "#FFFFFF"]}
                  style={styles.photoButtonGradient}
                >
                  <Camera color={Colors.light.tint} size={24} />
                  <Text style={styles.photoButtonText} numberOfLines={1}>
                    Retake Photo
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleGallery}
                disabled={isAnalyzing}
              >
                <LinearGradient
                  colors={[Colors.light.lightBlue, "#FFFFFF"]}
                  style={styles.photoButtonGradient}
                >
                  <ImagePlus color={Colors.light.tint} size={24} />
                  <Text style={styles.photoButtonText} numberOfLines={1}>
                    Choose from Gallery
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {isAnalyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={Colors.light.tint} />
                <Text style={styles.analyzingText}>AI is analyzing your meal...</Text>
                <Text style={styles.analyzingSubtext}>This may take up to a minute</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "800" as const,
    color: Colors.light.text,
    marginBottom: 4,
    letterSpacing: -1,
  },
  headerDate: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}20`,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.accent1,
  },
  content: {
    flex: 1,
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
    paddingBottom: 120,
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
  entryDescription: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
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
  fabContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "box-none",
  },
  fab: {
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
  fabGradient: {
    width: "100%",
    height: "100%",
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
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  imagePreview: {
    width: "100%",
    height: 280,
    backgroundColor: Colors.light.border,
  },
  removeImageButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600" as const,
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
  photoButtons: {
    flexDirection: "row",
    marginBottom: 24,
  },
  photoButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  photoButtonLeft: {
    marginRight: 12,
  },
  photoButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
    flexShrink: 1,
  },
  analyzingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  analyzingText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
});
