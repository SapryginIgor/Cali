import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { GoalType } from "@/constants/types";
import { useApp } from "@/contexts/AppContext";

export default function OnboardingScreen() {
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const { completeOnboarding } = useApp();
  const router = useRouter();

  const goals = [
    {
      type: "lose_weight" as GoalType,
      title: "Lose Weight",
      description: "Reduce body fat with balanced nutrition",
      icon: "📉",
    },
    {
      type: "gain_muscle" as GoalType,
      title: "Gain Muscle",
      description: "Build strength with high protein intake",
      icon: "💪",
    },
    {
      type: "maintain" as GoalType,
      title: "Maintain",
      description: "Keep a healthy balanced diet",
      icon: "⚖️",
    },
  ];

  const handleContinue = () => {
    if (selectedGoal) {
      completeOnboarding(selectedGoal);
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>What&apos;s your goal?</Text>
          <Text style={styles.subtitle}>
            We&apos;ll personalize your nutrition tracking based on your goal
          </Text>
        </View>

        <View style={styles.goalsContainer}>
          {goals.map((goal) => (
            <TouchableOpacity
              key={goal.type}
              style={[
                styles.goalCard,
                selectedGoal === goal.type && styles.goalCardSelected,
              ]}
              onPress={() => setSelectedGoal(goal.type)}
              activeOpacity={0.7}
            >
              <Text style={styles.goalIcon}>{goal.icon}</Text>
              <View style={styles.goalText}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <Text style={styles.goalDescription}>{goal.description}</Text>
              </View>
              {selectedGoal === goal.type && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !selectedGoal && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedGoal}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <ChevronRight color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    lineHeight: 24,
  },
  goalsContainer: {
    flex: 1,
    gap: 16,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  goalCardSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: "#ECFDF5",
  },
  goalIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  goalText: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    lineHeight: 20,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  continueButton: {
    flexDirection: "row",
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600" as const,
  },
});
