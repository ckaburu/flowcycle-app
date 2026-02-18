import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getRepository } from "../db";
import { CycleStart, Profile } from "../db/repo";
import { saveActiveProfileId } from "../domain/AppState";
import { isValidIsoDate } from "../utils/date";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  EmptyState,
  ErrorBanner,
  LoadingIndicator,
  ScreenContainer,
  colors,
  spacing,
} from "../ui";
import { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "CycleLog">;

const repository = getRepository();

export function CycleLogScreen({ navigation, route }: Props): ReactElement {
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
    <ScreenContainer>
      <AppText variant="heading" style={styles.title}>
        Cycle Log
      </AppText>
      <AppText variant="subheading" color={colors.textMuted} style={styles.subtitle}>
        {profile ? profile.name : `Profile ${profileId}`}
      </AppText>

      <View style={styles.navRow}>
        <AppButton
          title="Back to Profiles"
          variant="ghost"
          onPress={() => {
            void onBackToProfiles();
          }}
          style={styles.navButton}
        />
        <AppButton
          title="View Summary"
          variant="secondary"
          onPress={() => navigation.navigate("Summary")}
          style={styles.navButton}
        />
      </View>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}

      {!isLoading && cycleStarts.length === 0 ? (
        <EmptyState
          message="No cycle starts yet."
          hint="Add your first cycle start date below."
        />
      ) : null}

      {cycleStarts.map((entry) => (
        <AppCard key={entry.id} style={styles.entryCard}>
          <AppText variant="body">{entry.startDateIso}</AppText>
        </AppCard>
      ))}

      <View style={styles.inputRow}>
        <AppInput
          label="Start date"
          value={startDateInput}
          onChangeText={setStartDateInput}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <AppButton
          title="Add Cycle Start"
          onPress={() => {
            void onAddCycleStart();
          }}
          style={styles.addButton}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  navRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  navButton: {
    flex: 1,
  },
  entryCard: {
    marginBottom: spacing.sm,
  },
  inputRow: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addButton: {
    marginTop: spacing.xs,
  },
});
