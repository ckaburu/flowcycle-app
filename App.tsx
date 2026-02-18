import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getRepository } from "./src/db";
import { loadActiveProfileId } from "./src/domain/AppState";
import { CycleLogScreen } from "./src/screens/CycleLogScreen";
import { ProfilesScreen } from "./src/screens/ProfilesScreen";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { RootStackParamList } from "./src/screens/navigationTypes";

const repository = getRepository();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);

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

      if (isMounted) {
        setIsReady(true);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Profiles">
        <Stack.Screen name="Profiles" component={ProfilesScreen} />
        <Stack.Screen name="CycleLog" component={CycleLogScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
