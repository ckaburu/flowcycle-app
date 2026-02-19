import "react-native-gesture-handler";

import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getRepository } from "./src/db";
import { loadActiveProfileId } from "./src/domain/AppState";
import { getLockState, initLockState } from "./src/domain/LockState";
import {
  loadOnboardingCompleted,
  isOnboardingCompleted as getOnboardingCompleted,
} from "./src/domain/OnboardingState";
import { useAppLock } from "./src/hooks/useAppLock";
import { CycleLogScreen } from "./src/screens/CycleLogScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { OnboardingFlow } from "./src/screens/OnboardingFlow";
import { ProfilesScreen } from "./src/screens/ProfilesScreen";
import { SetupPinScreen } from "./src/screens/SetupPinScreen";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { RootStackParamList } from "./src/screens/navigationTypes";
import { LoadingIndicator, colors } from "./src/ui";

const repository = getRepository();
const Stack = createNativeStackNavigator<RootStackParamList>();

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
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
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
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: "600" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: "Dashboard" }}
          />
          <Stack.Screen name="Profiles" component={ProfilesScreen} />
          <Stack.Screen
            name="CycleLog"
            component={CycleLogScreen}
            options={{ title: "Cycle Log" }}
          />
          <Stack.Screen name="Summary" component={SummaryScreen} />
          <Stack.Screen
            name="SetupPin"
            component={SetupPinScreen}
            options={{ title: "PIN Settings" }}
          />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
