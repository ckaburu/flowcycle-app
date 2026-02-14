import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getRepository } from "./src/db";
import { loadActiveProfileId } from "./src/domain/AppState";
import { ProfilesScreen } from "./src/screens/ProfilesScreen";
import { RootStackParamList } from "./src/screens/navigationTypes";

const repository = getRepository();
const Stack = createNativeStackNavigator<RootStackParamList>();

function CycleLogPlaceholder(): JSX.Element {
  return (
    <View>
      <Text>Cycle Log</Text>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async (): Promise<void> => {
      try {
        await repository.init();
      } catch (error) {
        console.error("Failed to initialize SQLite repository", error);
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
        <Stack.Screen name="CycleLog" component={CycleLogPlaceholder} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
