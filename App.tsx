import "react-native-gesture-handler";

import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getRepository } from "./src/db";
import { loadActiveProfileId } from "./src/domain/AppState";
import { getLockState, initLockState } from "./src/domain/LockState";
import { CycleLogScreen } from "./src/screens/CycleLogScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { ProfilesScreen } from "./src/screens/ProfilesScreen";
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
  const [isLocked, setIsLocked] = useState(false);

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

      if (isMounted) {
        const state = getLockState();
        setIsLocked(state.isLocked);
        setIsReady(true);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingIndicator />
      </SafeAreaProvider>
    );
  }

  if (isLocked) {
    return (
      <SafeAreaProvider>
        <LockScreen onUnlock={handleUnlock} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName="Profiles"
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: "600" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="Profiles" component={ProfilesScreen} />
          <Stack.Screen
            name="CycleLog"
            component={CycleLogScreen}
            options={{ title: "Cycle Log" }}
          />
          <Stack.Screen name="Summary" component={SummaryScreen} />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
