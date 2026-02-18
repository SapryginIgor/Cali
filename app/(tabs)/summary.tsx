import { generateText } from "@/lib/ai";
import { TrendingDown, TrendingUp, Minus, Sparkles, Target } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getGoalIcon = () => {
    if (profile.goal === "lose_weight") return <TrendingDown color="#FFFFFF" size={24} />;
    if (profile.goal === "gain_muscle") return <TrendingUp color="#FFFFFF" size={24} />;
    return <Minus color="#FFFFFF" size={24} />;
  };

  const getGoalText = () => {
    if (profile.goal === "lose_weight") return "Lose Weight";
    if (profile.goal === "gain_muscle") return "Gain Muscle";
    return "Maintain Weight";
  };

  const getGoalColor = (): [string, string] => {
    if (profile.goal === "lose_weight") return ["#EF4444", "#DC2626"];
    if (profile.goal === "gain_muscle") return ["#10B981", "#059669"];
    return ["#F97316", "#EA580C"]; // Rich Orange gradient
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
            <Text style={styles.headerTitle}>Summary</Text>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Goal Card */}
          <View style={styles.goalCard}>
            <LinearGradient
              colors={getGoalColor()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.goalCardGradient}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalIconContainer}>
                  {getGoalIcon()}
                </View>
                <View style={styles.goalTextContainer}>
                  <Text style={styles.goalLabel}>Your Goal</Text>
                  <Text style={styles.goalText}>{getGoalText()}</Text>
                </View>
              </View>
              <View style={styles.goalStats}>
                <View style={styles.goalStatItem}>
                  <Text style={styles.goalStatValue}>{entries.length}</Text>
                  <Text style={styles.goalStatLabel}>Meals Today</Text>
                </View>
                <View style={styles.goalStatDivider} />
                <View style={styles.goalStatItem}>
                  <Text style={styles.goalStatValue}>
                    {Math.round(totals.calories)}
                  </Text>
                  <Text style={styles.goalStatLabel}>Total Calories</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconContainer}>
                <Target size={48} color={Colors.light.secondaryText} />
              </View>
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptySubtitle}>
                Start logging meals to see your daily summary and AI-powered insights
              </Text>
            </View>
          ) : (
            <>
              {/* Nutrition Breakdown Card */}
              <View style={styles.macrosCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.sectionTitle}>Nutrition Breakdown</Text>
                </View>

                {/* Calories - Featured */}
                <View style={styles.caloriesCard}>
                  <LinearGradient
                    colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.caloriesCardGradient}
                  >
                    <View style={styles.caloriesHeader}>
                      <View>
                        <Text style={styles.caloriesLabel}>Total Calories</Text>
                        <Text style={styles.caloriesValue}>
                          {Math.round(totals.calories)}
                        </Text>
                        <Text style={styles.caloriesGoal}>
                          cal
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Macros */}
                <View style={styles.macrosList}>
                  <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                      <View style={styles.macroHeader}>
                        <View style={[styles.macroDot, { backgroundColor: Colors.light.macroProtein }]} />
                        <Text style={styles.macroLabel}>Protein</Text>
                      </View>
                      <Text style={styles.macroNumbers}>
                        {Math.round(totals.protein)}g
                      </Text>
                    </View>
                  </View>

                  <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                      <View style={styles.macroHeader}>
                        <View style={[styles.macroDot, { backgroundColor: Colors.light.macroCarbs }]} />
                        <Text style={styles.macroLabel}>Carbs</Text>
                      </View>
                      <Text style={styles.macroNumbers}>
                        {Math.round(totals.carbs)}g
                      </Text>
                    </View>
                  </View>

                  <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                      <View style={styles.macroHeader}>
                        <View style={[styles.macroDot, { backgroundColor: Colors.light.macroFats }]} />
                        <Text style={styles.macroLabel}>Fats</Text>
                      </View>
                      <Text style={styles.macroNumbers}>
                        {Math.round(totals.fats)}g
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* AI Insights Card */}
              <View style={styles.tipsCard}>
                <LinearGradient
                  colors={[Colors.light.lightBlue, "#FFFFFF"]}
                  style={styles.tipsCardGradient}
                >
                  <View style={styles.tipsHeader}>
                    <View style={styles.tipsHeaderLeft}>
                      <View style={styles.tipsIconContainer}>
                        <Sparkles size={20} color={Colors.light.accent1} />
                      </View>
                      <Text style={styles.sectionTitle}>AI Insights</Text>
                    </View>
                  </View>
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
                </LinearGradient>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
  content: {
    flex: 1,
  },
  goalCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  goalCardGradient: {
    padding: 24,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  goalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalTextContainer: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  goalText: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  goalStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  goalStatItem: {
    flex: 1,
  },
  goalStatValue: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  goalStatLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500" as const,
  },
  goalStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  macrosCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 28,
    padding: 24,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  cardHeaderBadge: {
    backgroundColor: Colors.light.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}20`,
  },
  cardHeaderBadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.light.accent1,
  },
  caloriesCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: Colors.light.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  caloriesCardGradient: {
    padding: 24,
  },
  caloriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  caloriesLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  caloriesValue: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: 4,
  },
  caloriesGoal: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: "rgba(255, 255, 255, 0.8)",
  },
  caloriesStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  caloriesStatusText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  caloriesProgressBar: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  caloriesProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  macrosList: {
    gap: 20,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroInfo: {
    flex: 1,
  },
  macroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.secondaryText,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  macroNumbers: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  macroProgressBar: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  macroProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  macroStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 16,
  },
  macroStatusText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  tipsCard: {
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: Colors.light.accent1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}20`,
  },
  tipsCardGradient: {
    padding: 24,
  },
  tipsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  tipsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${Colors.light.accent1}20`,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  tipsText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.text,
    fontWeight: "500" as const,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginTop: 16,
  },
  emptyStateCard: {
    marginHorizontal: 24,
    marginTop: 40,
    alignItems: "center",
    paddingVertical: 60,
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
    paddingHorizontal: 20,
  },
});
