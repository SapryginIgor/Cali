import { generateText } from "@rork-ai/toolkit-sdk";
import { TrendingDown, TrendingUp, Minus } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function SummaryScreen() {
  const { profile, getTodayTotals, getTodayEntries } = useApp();
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const totals = getTodayTotals();
  const entries = getTodayEntries();

  const generateAiTips = useCallback(async () => {
    if (!profile) return;

    setIsLoading(true);
    try {
      const goalText =
        profile.goal === "lose_weight"
          ? "losing weight"
          : profile.goal === "gain_muscle"
            ? "gaining muscle"
            : "maintaining weight";

      const prompt = `You are a nutrition expert. Analyze this daily nutrition summary and provide 2-3 concise, actionable tips.

Goal: ${goalText}
Daily Targets: ${profile.dailyGoals.calories} cal, ${profile.dailyGoals.protein}g protein, ${profile.dailyGoals.carbs}g carbs, ${profile.dailyGoals.fats}g fats

Today's Intake: ${Math.round(totals.calories)} cal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fats)}g fats

Meals: ${entries.map((e) => e.description).join(", ")}

Provide brief, encouraging tips (2-3 sentences total). Focus on what they can improve tomorrow.`;

      const tips = await generateText(prompt);
      setAiTips(tips);
    } catch (error) {
      console.error("Error generating AI tips:", error);
      setAiTips("Keep up the great work tracking your nutrition! Stay consistent with your goals.");
    } finally {
      setIsLoading(false);
    }
  }, [profile, totals.calories, totals.protein, totals.carbs, totals.fats, entries]);

  useEffect(() => {
    if (entries.length > 0 && profile) {
      generateAiTips();
    }
  }, [entries.length, profile, generateAiTips]);

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getGoalIcon = () => {
    if (profile.goal === "lose_weight") return <TrendingDown color={Colors.light.tint} size={24} />;
    if (profile.goal === "gain_muscle") return <TrendingUp color={Colors.light.tint} size={24} />;
    return <Minus color={Colors.light.tint} size={24} />;
  };

  const getGoalText = () => {
    if (profile.goal === "lose_weight") return "Lose Weight";
    if (profile.goal === "gain_muscle") return "Gain Muscle";
    return "Maintain Weight";
  };

  const getProgress = (current: number, goal: number) => {
    const percentage = (current / goal) * 100;
    const difference = current - goal;
    return { percentage, difference };
  };

  const caloriesProgress = getProgress(totals.calories, profile.dailyGoals.calories);
  const proteinProgress = getProgress(totals.protein, profile.dailyGoals.protein);
  const carbsProgress = getProgress(totals.carbs, profile.dailyGoals.carbs);
  const fatsProgress = getProgress(totals.fats, profile.dailyGoals.fats);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Summary</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            {getGoalIcon()}
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalLabel}>Your Goal</Text>
              <Text style={styles.goalText}>{getGoalText()}</Text>
            </View>
          </View>
        </View>

        {entries.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Start logging meals to see your daily summary
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.macrosCard}>
              <Text style={styles.sectionTitle}>Nutrition Breakdown</Text>

              <View style={styles.macroRow}>
                <View style={styles.macroInfo}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={styles.macroNumbers}>
                    {Math.round(totals.calories)} / {profile.dailyGoals.calories}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.macroStatus,
                    caloriesProgress.difference > 0
                      ? styles.macroStatusOver
                      : styles.macroStatusUnder,
                  ]}
                >
                  {caloriesProgress.difference > 0 ? "+" : ""}
                  {Math.round(caloriesProgress.difference)} cal
                </Text>
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroInfo}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.macroDot, { backgroundColor: "#3B82F6" }]} />
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <Text style={styles.macroNumbers}>
                    {Math.round(totals.protein)}g / {profile.dailyGoals.protein}g
                  </Text>
                </View>
                <Text
                  style={[
                    styles.macroStatus,
                    proteinProgress.difference > 0
                      ? styles.macroStatusOver
                      : styles.macroStatusUnder,
                  ]}
                >
                  {proteinProgress.difference > 0 ? "+" : ""}
                  {Math.round(proteinProgress.difference)}g
                </Text>
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroInfo}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.macroDot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <Text style={styles.macroNumbers}>
                    {Math.round(totals.carbs)}g / {profile.dailyGoals.carbs}g
                  </Text>
                </View>
                <Text
                  style={[
                    styles.macroStatus,
                    carbsProgress.difference > 0
                      ? styles.macroStatusOver
                      : styles.macroStatusUnder,
                  ]}
                >
                  {carbsProgress.difference > 0 ? "+" : ""}
                  {Math.round(carbsProgress.difference)}g
                </Text>
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroInfo}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.macroDot, { backgroundColor: "#EF4444" }]} />
                    <Text style={styles.macroLabel}>Fats</Text>
                  </View>
                  <Text style={styles.macroNumbers}>
                    {Math.round(totals.fats)}g / {profile.dailyGoals.fats}g
                  </Text>
                </View>
                <Text
                  style={[
                    styles.macroStatus,
                    fatsProgress.difference > 0
                      ? styles.macroStatusOver
                      : styles.macroStatusUnder,
                  ]}
                >
                  {fatsProgress.difference > 0 ? "+" : ""}
                  {Math.round(fatsProgress.difference)}g
                </Text>
              </View>
            </View>

            <View style={styles.tipsCard}>
              <Text style={styles.sectionTitle}>AI Insights</Text>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.tint} />
                  <Text style={styles.loadingText}>Generating personalized tips...</Text>
                </View>
              ) : aiTips ? (
                <Text style={styles.tipsText}>{aiTips}</Text>
              ) : (
                <Text style={styles.tipsText}>
                  Great job tracking your meals today! Keep it up to reach your goals.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
  goalCard: {
    margin: 20,
    marginBottom: 16,
    backgroundColor: Colors.light.lightPurple,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.light.accent2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalTextContainer: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 14,
    color: Colors.light.accent2,
    marginBottom: 4,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  goalText: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  macrosCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  macroInfo: {
    flex: 1,
  },
  macroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  macroNumbers: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  macroStatus: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  macroStatusOver: {
    color: Colors.light.warning,
  },
  macroStatusUnder: {
    color: Colors.light.secondaryText,
  },
  tipsCard: {
    marginHorizontal: 20,
    marginBottom: 32,
    backgroundColor: Colors.light.lightBlue,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.light.accent1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  tipsText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.text,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  emptyStateCard: {
    marginHorizontal: 24,
    marginTop: 60,
    alignItems: "center",
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
});
