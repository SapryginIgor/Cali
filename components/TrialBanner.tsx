import Colors from "@/constants/colors";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Clock, Sparkles } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function TrialBanner() {
  const { status, daysRemaining, presentPaywall } = useSubscription();

  if (status !== "trialing" || daysRemaining === null) return null;

  const isUrgent = daysRemaining <= 2;
  const label =
    daysRemaining === 0
      ? "Trial ends today"
      : daysRemaining === 1
        ? "Trial ends tomorrow"
        : `Trial: ${daysRemaining} days left`;

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      <View style={styles.row}>
        {isUrgent ? (
          <Clock size={14} color={isUrgent ? "#92400E" : Colors.light.secondaryText} />
        ) : (
          <Sparkles size={14} color={Colors.light.tint} />
        )}
        <Text style={[styles.label, isUrgent && styles.labelUrgent]}>{label}</Text>
      </View>
      {isUrgent && (
        <TouchableOpacity onPress={presentPaywall} hitSlop={8}>
          <Text style={styles.link}>See plans</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: `${Colors.light.tint}10`,
    borderWidth: 1,
    borderColor: `${Colors.light.tint}20`,
  },
  containerUrgent: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  labelUrgent: {
    color: "#92400E",
    fontWeight: "700" as const,
  },
  link: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.light.tint,
  },
});
