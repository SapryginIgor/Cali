import Colors from "@/constants/colors";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, RotateCcw, Sparkles, X, Zap } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

const FEATURES = [
  { icon: Sparkles, label: "AI-powered food analysis" },
  { icon: Zap, label: "Unlimited meal logging" },
  { icon: Crown, label: "Detailed nutrition breakdowns" },
];

export default function PaywallModal() {
  const { paywallVisible, dismissPaywall, status } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [priceLabel, setPriceLabel] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const monthly = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
      if (monthly) {
        setPkg(monthly);
        setPriceLabel(monthly.product.priceString);
      }
    } catch {
      // RevenueCat not configured or no offerings — fall through to fallback UI
    }
  }, []);

  const handlePresent = useCallback(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const handlePurchase = useCallback(async () => {
    if (!pkg) return;
    setLoading(true);
    try {
      await Purchases.purchasePackage(pkg);
      dismissPaywall();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        Alert.alert("Purchase failed", err.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [pkg, dismissPaywall]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      const hasEntitlement = info.entitlements.active["premium"] !== undefined;
      if (hasEntitlement) {
        dismissPaywall();
      } else {
        Alert.alert("No purchases found", "We couldn't find any active subscriptions for your account.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not restore purchases.";
      Alert.alert("Restore failed", message);
    } finally {
      setRestoring(false);
    }
  }, [dismissPaywall]);

  const headline =
    status === "trial_expired"
      ? "Your trial has ended"
      : status === "cancelled"
        ? "Welcome back"
        : "Go Premium";

  const subtitle =
    status === "trial_expired"
      ? "Subscribe to keep logging meals with AI-powered analysis."
      : status === "cancelled"
        ? "Reactivate your subscription to unlock all features."
        : "Unlock the full Cali experience.";

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={dismissPaywall}
      onShow={handlePresent}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={["#FFFFFF", "#FFF7ED", "#FFEDD5"]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={dismissPaywall}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={22} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                style={styles.iconGradient}
              >
                <Crown size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.features}>
              {FEATURES.map(({ icon: Icon, label }) => (
                <View key={label} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon size={18} color={Colors.light.tint} />
                  </View>
                  <Text style={styles.featureText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            {priceLabel && (
              <Text style={styles.priceText}>{priceLabel}/month</Text>
            )}

            <TouchableOpacity
              style={[styles.subscribeButton, loading && styles.buttonDisabled]}
              onPress={handlePurchase}
              disabled={loading || !pkg}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.subscribeGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.subscribeText}>
                    {pkg ? "Subscribe" : "Loading..."}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={Colors.light.secondaryText} />
              ) : (
                <View style={styles.restoreRow}>
                  <RotateCcw size={14} color={Colors.light.secondaryText} />
                  <Text style={styles.restoreText}>Restore purchases</Text>
                </View>
              )}
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <Text style={styles.legal}>
                Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
              </Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
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
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 28,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.light.text,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 36,
    paddingHorizontal: 12,
  },
  features: {
    width: "100%",
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${Colors.light.tint}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 12,
    alignItems: "center",
  },
  priceText: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  subscribeButton: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.light.gradientStart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscribeGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  restoreButton: {
    paddingVertical: 10,
  },
  restoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: "500" as const,
  },
  legal: {
    fontSize: 11,
    color: Colors.light.tertiaryText,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
