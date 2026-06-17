import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isLoading: appLoading } = useApp();
  const { loading: authLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (appLoading || authLoading) return;

    SplashScreen.hideAsync();

    const inAuth = segments[0] === "(auth)";
    const inMain = segments[0] === "(main)";

    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && !inMain) {
      router.replace("/(main)");
    }
  }, [appLoading, authLoading, user, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <SubscriptionProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </SubscriptionProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
