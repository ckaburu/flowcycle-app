import "react-native-gesture-handler";

import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getRepository } from "./src/db";
import { loadActiveProfileId } from "./src/domain/AppState";
import { getLockState, initLockState } from "./src/domain/LockState";
import {
  loadOnboardingCompleted,
  isOnboardingCompleted as getOnboardingCompleted,
} from "./src/domain/OnboardingState";
import { syncNotifications } from "./src/domain/syncNotifications";
import { devSyncLogger } from "./src/domain/devSyncLogger";
import { ExpoNotificationAdapter } from "./src/utils/expoNotificationAdapter";
import { useAppLock } from "./src/hooks/useAppLock";
import { LockScreen } from "./src/screens/LockScreen";
import { OnboardingFlow } from "./src/screens/OnboardingFlow";
import { TabNavigator } from "./src/navigation/TabNavigator";
import { LoadingIndicator, colors } from "./src/ui";

const repository = getRepository();
const notificationAdapter = new ExpoNotificationAdapter();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { isLocked, setIsLocked } = useAppLock();
  const [hasPinSet, setHasPinSet] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // default true to avoid flash

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async (): Promise<void> => {
      try {
        await repository.init();
      } catch (error) {
        console.error("Failed to initialize Realm repository", error);
      }

      try {
        await loadActiveProfileId();
      } catch (error) {
        console.error("Failed to load active profile id", error);
      }

      try {
        await initLockState();
      } catch (error) {
        console.error("Failed to initialize lock state", error);
      }

      try {
        await loadOnboardingCompleted();
      } catch (error) {
        console.error("Failed to load onboarding state", error);
      }

      if (isMounted) {
        const state = getLockState();
        setHasPinSet(state.isPinSet);
        setIsLocked(state.isLocked);
        setOnboardingCompleted(getOnboardingCompleted());
        setIsReady(true);

        // Fire-and-forget notification sync after bootstrap
        syncNotifications(
          repository,
          notificationAdapter,
          __DEV__ ? devSyncLogger : undefined,
        ).catch((err) =>
          console.error("[NotifSync] Bootstrap sync failed:", err),
        );
      }
    };

    void bootstrap();

    // Re-sync notifications when app returns to foreground.
    // Handles timezone changes, midnight rollovers, and Doze alarm resets.
    const appStateRef: { current: AppStateStatus } = { current: AppState.currentState };
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        (appStateRef.current === "background" ||
          appStateRef.current === "inactive") &&
        nextState === "active"
      ) {
        syncNotifications(
          repository,
          notificationAdapter,
          __DEV__ ? devSyncLogger : undefined,
        ).catch((err) =>
          console.error("[NotifSync] Foreground sync failed:", err),
        );
      }
      appStateRef.current = nextState;
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [setIsLocked]);

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
  }, [setIsLocked]);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingCompleted(true);
  }, []);

  // ─── Gate 1: Bootstrap not complete → show loading ─────────────────
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingIndicator />
      </SafeAreaProvider>
    );
  }

  // ─── Gate 2: PIN exists AND app is locked → show lock screen ───────
  //     Skipped when no PIN exists (first launch), preventing
  //     LockScreen from ever flashing before onboarding.
  if (hasPinSet && isLocked) {
    return (
      <SafeAreaProvider>
        <LockScreen onUnlock={handleUnlock} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  // ─── Gate 3: Onboarding not completed → show onboarding flow ───────
  //     Reached on first launch (no PIN) or after unlock on crash recovery.
  if (!onboardingCompleted) {
    return (
      <SafeAreaProvider>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  // ─── Gate 4: All gates passed → show main app ─────────────────────
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <TabNavigator />
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
