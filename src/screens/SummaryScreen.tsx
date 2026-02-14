import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Button, Text, View } from "react-native";

import { getRepository } from "../db";
import { getAppState, loadActiveProfileId } from "../domain/AppState";
import {
  computeCycleDay,
  estimateNextStart,
  formatIsoDate,
  typicalCycleLength,
} from "../domain/cycleMath";
import { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "Summary">;

type SummaryData = {
  profileName: string;
  sortedStartDates: string[];
  lastStart: string | null;
  cycleDay: number | null;
  typicalLen: number | null;
  nextStartEstimate: string | null;
};

const repository = getRepository();

export function SummaryScreen({ navigation }: Props): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const loadSummary = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      let activeProfileId = getAppState().activeProfileId;
      if (activeProfileId === null) {
        activeProfileId = await loadActiveProfileId();
      }

      if (activeProfileId === null) {
        setError("No active profile selected.");
        setSummary(null);
        return;
      }

      const [profiles, cycleStarts] = await Promise.all([
        repository.listProfiles(),
        repository.listCycleStarts(activeProfileId),
      ]);

      const profile = profiles.find((candidate) => candidate.id === activeProfileId) ?? null;
      if (!profile) {
        setError("Active profile not found.");
        setSummary(null);
        return;
      }

      const sortedStartDates = cycleStarts
        .map((entry) => entry.startDateIso)
        .sort((a, b) => a.localeCompare(b));

      const lastStart =
        sortedStartDates.length > 0 ? sortedStartDates[sortedStartDates.length - 1] : null;

      const cycleDay =
        lastStart !== null ? computeCycleDay(formatIsoDate(new Date()), lastStart) : null;
      const typicalLen = typicalCycleLength(sortedStartDates);
      const nextStartEstimate =
        lastStart !== null && typicalLen !== null ? estimateNextStart(lastStart, typicalLen) : null;

      setSummary({
        profileName: profile.name,
        sortedStartDates,
        lastStart,
        cycleDay,
        typicalLen,
        nextStartEstimate,
      });
    } catch {
      setError("Failed to load summary.");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  return (
    <View>
      <Text>Summary</Text>
      <Button title="Back" onPress={() => navigation.goBack()} />

      {isLoading ? <Text>Loading...</Text> : null}
      {error ? <Text>{error}</Text> : null}

      {summary ? (
        <View>
          <Text>Profile: {summary.profileName}</Text>
          <Text>Last Start: {summary.lastStart ?? "-"}</Text>
          <Text>Cycle Day: {summary.cycleDay ?? "-"}</Text>
          <Text>
            Typical Cycle Length: {summary.typicalLen !== null ? `${summary.typicalLen} days` : "-"}
          </Text>
          <Text>Next Start Estimate: {summary.nextStartEstimate ?? "-"}</Text>
          {summary.sortedStartDates.length < 2 ? (
            <Text>Add at least two cycle starts to see estimates.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
