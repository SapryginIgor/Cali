import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useProfile } from "@/hooks/useProfile";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft, Crown, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, signIn, signUp, signOut, isSupabaseConfigured } = useAuth();
  const { data: profile, isLoading: profileLoading, updateProfile, isUpdating } = useProfile();

  const { status, daysRemaining, isPremium, presentPaywall, presentCustomerCenter } = useSubscription();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter email and password.");
      return;
    }
    setAuthBusy(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        Alert.alert(
          "Check your email",
          "If email confirmation is enabled, confirm your address before signing in."
        );
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      Alert.alert("Authentication failed", message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      Alert.alert("Saved", "Your profile was updated.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not save profile";
      Alert.alert("Error", message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setEmail("");
      setPassword("");
      setDisplayName("");
      setAvatarUrl("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not sign out";
      Alert.alert("Error", message);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#FFFFFF", "#FFF7ED", "#FFEDD5"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ChevronLeft size={28} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Profile</Text>
            <View style={styles.topBarSpacer} />
          </View>
          <View style={styles.configMessage}>
            <Text style={styles.configTitle}>Supabase not configured</Text>
            <Text style={styles.configBody}>
              Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file, restart
              Metro, and apply the SQL migration in supabase/migrations to your Supabase project.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFFFF", "#FFF7ED", "#FFEDD5"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ChevronLeft size={28} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Profile</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {authLoading ? (
              <ActivityIndicator size="large" color={Colors.light.accent1} style={styles.loader} />
            ) : !user ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <User size={22} color={Colors.light.accent1} />
                  <Text style={styles.cardTitle}>{isSignUp ? "Create account" : "Sign in"}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.light.tertiaryText}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.light.tertiaryText}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, authBusy && styles.primaryButtonDisabled]}
                  onPress={() => void handleAuth()}
                  disabled={authBusy}
                >
                  {authBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{isSignUp ? "Sign up" : "Sign in"}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.switchMode} onPress={() => setIsSignUp(!isSignUp)}>
                  <Text style={styles.switchModeText}>
                    {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : profileLoading ? (
              <ActivityIndicator size="large" color={Colors.light.accent1} style={styles.loader} />
            ) : (
              <>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Crown size={18} color={isPremium ? Colors.light.tint : Colors.light.secondaryText} />
                  <Text style={styles.subscriptionTitle}>
                    {status === "premium"
                      ? "Premium"
                      : status === "trialing"
                        ? "Free Trial"
                        : status === "cancelled"
                          ? "Cancelled"
                          : "Trial Expired"}
                  </Text>
                </View>
                {status === "trialing" && daysRemaining !== null && (
                  <Text style={styles.subscriptionDetail}>
                    {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
                  </Text>
                )}
                {status === "premium" ? (
                  <TouchableOpacity
                    style={styles.manageButton}
                    onPress={() => void presentCustomerCenter()}
                  >
                    <Text style={styles.manageButtonText}>Manage subscription</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.seePlansButton} onPress={presentPaywall}>
                    <LinearGradient
                      colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.seePlansGradient}
                    >
                      <Text style={styles.seePlansText}>See plans</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.signedInEmail}>{user.email}</Text>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.light.tertiaryText}
                  value={displayName}
                  onChangeText={setDisplayName}
                />
                <Text style={styles.label}>Avatar URL (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={Colors.light.tertiaryText}
                  autoCapitalize="none"
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, isUpdating && styles.primaryButtonDisabled]}
                  onPress={() => void handleSaveProfile()}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save profile</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signOutButton} onPress={() => void handleSignOut()}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </TouchableOpacity>
              </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 4,
    marginRight: 4,
  },
  topTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    textAlign: "center",
  },
  topBarSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 48,
  },
  card: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  signedInEmail: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 14,
    backgroundColor: "#FAFAFA",
  },
  primaryButton: {
    backgroundColor: Colors.light.accent1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  switchMode: {
    marginTop: 16,
    alignItems: "center",
  },
  switchModeText: {
    color: Colors.light.accent1,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  signOutButton: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 12,
  },
  signOutText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  subscriptionCard: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: 8,
    marginBottom: 12,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  subscriptionDetail: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 14,
  },
  seePlansButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  seePlansGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  seePlansText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  manageButton: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  manageButtonText: {
    color: Colors.light.accent1,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  configMessage: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  configTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  configBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.secondaryText,
  },
});
