import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";

import { getRepository } from "../db";
import { CycleStart, Profile } from "../db/repo";
import { saveActiveProfileId } from "../domain/AppState";
import { isValidIsoDate } from "../utils/date";
import { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "CycleLog">;

const repository = getRepository();

export function CycleLogScreen({ navigation, route }: Props): JSX.Element {
  const profileId = route.params.profileId;
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cycleStarts, setCycleStarts] = useState<CycleStart[]>([]);
  const [startDateInput, setStartDateInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [profiles, starts] = await Promise.all([
        repository.listProfiles(),
        repository.listCycleStarts(profileId),
      ]);

      const activeProfile = profiles.find((candidate) => candidate.id === profileId) ?? null;
      if (!activeProfile) {
        setError("Active profile not found.");
      }

      setProfile(activeProfile);
      setCycleStarts(starts);
    } catch {
      setError("Failed to load cycle data.");
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const onAddCycleStart = async (): Promise<void> => {
    const dateValue = startDateInput.trim();
    if (!isValidIsoDate(dateValue)) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }

    try {
      setError(null);
      await repository.addCycleStart(profileId, dateValue);
      setStartDateInput("");
      await loadData();
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError("Failed to add cycle start.");
      }
    }
  };

  const onBackToProfiles = async (): Promise<void> => {
    await saveActiveProfileId(null);
    navigation.navigate("Profiles");
  };

  return (
    <View>
      <Text>Cycle Log</Text>
      <Text>Profile: {profile ? profile.name : `id ${profileId}`}</Text>
      <Button
        title="Back to Profiles"
        onPress={() => {
          void onBackToProfiles();
        }}
      />
      <Button title="View Summary" onPress={() => navigation.navigate("Summary")} />

      {isLoading ? <Text>Loading...</Text> : null}
      {error ? <Text>{error}</Text> : null}

      {!isLoading && cycleStarts.length === 0 ? <Text>No cycle starts yet.</Text> : null}

      {cycleStarts.map((entry) => (
        <Text key={entry.id}>{entry.startDateIso}</Text>
      ))}

      <TextInput
        value={startDateInput}
        onChangeText={setStartDateInput}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      <Button
        title="Add Cycle Start"
        onPress={() => {
          void onAddCycleStart();
        }}
      />
    </View>
  );
}
