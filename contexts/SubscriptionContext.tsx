import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/constants/types";

const ENTITLEMENT_ID = "Cali Pro";

const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? "";
const isRevenueCatConfigured = Boolean(
  Platform.OS === "ios" ? RC_IOS_KEY : RC_ANDROID_KEY
);

function computeDaysRemaining(trialEndsAt: string | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const [SubscriptionProvider, useSubscription] = createContextHook(
  () => {
    const { user } = useAuth();
    const { data: profile } = useProfile();
    const rcConfiguredRef = useRef(false);

    const dbStatus = profile?.subscription_status ?? "trialing";
    const trialEndsAt = profile?.trial_ends_at;
    const daysRemaining = computeDaysRemaining(trialEndsAt);

    const status: SubscriptionStatus = useMemo(() => {
      if (dbStatus === "premium" || dbStatus === "cancelled") return dbStatus;
      if (dbStatus === "trialing" && daysRemaining !== null && daysRemaining <= 0)
        return "trial_expired";
      return dbStatus;
    }, [dbStatus, daysRemaining]);

    const isPremium = __DEV__ || status === "trialing" || status === "premium";
    const isTrialExpired = status === "trial_expired";

    // --- RevenueCat setup ---
    useEffect(() => {
      if (!user || !isRevenueCatConfigured || rcConfiguredRef.current) return;

      const apiKey = Platform.OS === "ios" ? RC_IOS_KEY : RC_ANDROID_KEY;

      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey, appUserID: user.id });
      rcConfiguredRef.current = true;

      void Purchases.getCustomerInfo().then((info) => syncEntitlements(info));
    }, [user]);

    // Customer info listener — sync RC state → Supabase
    useEffect(() => {
      if (!rcConfiguredRef.current) return;

      const listener = (info: CustomerInfo) => syncEntitlements(info);
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => Purchases.removeCustomerInfoUpdateListener(listener);
    }, []);

    const syncEntitlements = useCallback(
      async (info: CustomerInfo) => {
        if (!user) return;
        const hasEntitlement =
          info.entitlements.active[ENTITLEMENT_ID] !== undefined;

        const newStatus: SubscriptionStatus = hasEntitlement
          ? "premium"
          : dbStatus === "premium"
            ? "cancelled"
            : dbStatus;

        if (newStatus !== dbStatus) {
          await supabase
            .from("profiles")
            .update({ subscription_status: newStatus })
            .eq("id", user.id);
        }
      },
      [user, dbStatus]
    );

    // RevenueCat logout on sign-out
    useEffect(() => {
      if (!user && rcConfiguredRef.current) {
        void Purchases.logOut();
        rcConfiguredRef.current = false;
      }
    }, [user]);

    // Present the RevenueCat Paywall UI. Always shows so the user can
    // choose between Monthly / Yearly / Lifetime offerings.
    const presentPaywall = useCallback(async () => {
      if (!isRevenueCatConfigured) return;
      try {
        const result = await RevenueCatUI.presentPaywall();
        if (
          result === PAYWALL_RESULT.PURCHASED ||
          result === PAYWALL_RESULT.RESTORED
        ) {
          const info = await Purchases.getCustomerInfo();
          await syncEntitlements(info);
        }
      } catch {
        // RevenueCatUI not available on this platform (e.g. web)
      }
    }, [syncEntitlements]);

    // Open the RevenueCat Customer Center so users can manage / cancel.
    const presentCustomerCenter = useCallback(async () => {
      if (!isRevenueCatConfigured) return;
      try {
        await RevenueCatUI.presentCustomerCenter();
      } catch {
        // Not available on this platform
      }
    }, []);

    return {
      status,
      isPremium,
      isTrialExpired,
      daysRemaining,
      presentPaywall,
      presentCustomerCenter,
    };
  }
);
