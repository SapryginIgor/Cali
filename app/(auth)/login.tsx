import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(trimmed, password);
        Alert.alert(
          "Check your email",
          "If email confirmation is enabled, confirm your address before signing in."
        );
      } else {
        await signIn(trimmed, password);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      Alert.alert("Authentication failed", message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFFFF", "#FFF7ED", "#FFEDD5", "#FED7AA"]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroSection}>
              <Text style={styles.appName}>Cali</Text>
              <Text style={styles.tagline}>Track what you eat, effortlessly</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {isSignUp ? "Create your account" : "Welcome back"}
              </Text>
              <Text style={styles.formSubtitle}>
                {isSignUp
                  ? "Sign up to start tracking your meals"
                  : "Sign in to continue"}
              </Text>

              <View style={styles.inputWrapper}>
                <Mail size={18} color={Colors.light.tertiaryText} style={styles.inputIcon} />
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
              </View>

              <View style={styles.inputWrapper}>
                <Lock size={18} color={Colors.light.tertiaryText} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={Colors.light.tertiaryText}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.light.tertiaryText} />
                  ) : (
                    <Eye size={18} color={Colors.light.tertiaryText} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                onPress={() => void handleAuth()}
                disabled={busy}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isSignUp ? "Create account" : "Sign in"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsSignUp(!isSignUp)}
                activeOpacity={0.7}
              >
                <Text style={styles.switchText}>
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                  <Text style={styles.switchTextBold}>
                    {isSignUp ? "Sign in" : "Sign up"}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  passwordInput: {
    paddingRight: 36,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  primaryButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: Colors.light.tertiaryText,
    fontWeight: "500",
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
  },
  switchTextBold: {
    color: Colors.light.accent1,
    fontWeight: "700",
  },
});
