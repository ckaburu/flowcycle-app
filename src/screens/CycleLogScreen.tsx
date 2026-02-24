import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { getRepository } from "../db";
import { CycleStart, Profile } from "../db/repo";
import { DuplicateCycleStartError, FutureDateError } from "../domain/errors";
import { syncNotifications } from "../domain/syncNotifications";
import { devSyncLogger } from "../domain/devSyncLogger";
import { ExpoNotificationAdapter } from "../utils/expoNotificationAdapter";
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
import type { ProfilesStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<ProfilesStackParamList, "CycleLog">;

const repository = getRepository();

function fireAndForgetSync(): void {
  syncNotifications(
    repository,
    new ExpoNotificationAdapter(),
    __DEV__ ? devSyncLogger : undefined,
  ).catch((err) => console.error("[NotifSync] sync failed:", err));
}

function userMessage(caught: unknown): string {
  if (caught instanceof DuplicateCycleStartError) {
    return caught.message;
  }
  if (caught instanceof FutureDateError) {
    return caught.message;
  }
  if (caught instanceof Error) {
    return caught.message;
  }
  return "An unexpected error occurred.";
}

export function CycleLogScreen({ route }: Props): ReactElement {
  const profileId = route.params.profileId;
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cycleStarts, setCycleStarts] = useState<CycleStart[]>([]);
  const [startDateInput, setStartDateInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Edit state: which entry is being edited, and the draft value
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDateInput, setEditDateInput] = useState("");

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

  // ── Add ──────────────────────────────────────────────────────────────

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
      fireAndForgetSync();
    } catch (caught) {
      setError(userMessage(caught));
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────

  const onStartEdit = (entry: CycleStart): void => {
    setEditingId(entry.id);
    setEditDateInput(entry.startDateIso);
    setError(null);
  };

  const onCancelEdit = (): void => {
    setEditingId(null);
    setEditDateInput("");
  };

  const onSaveEdit = async (): Promise<void> => {
    if (editingId === null) return;

    const dateValue = editDateInput.trim();
    if (!isValidIsoDate(dateValue)) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }

    try {
      setError(null);
      await repository.updateCycleStart(editingId, dateValue);
      setEditingId(null);
      setEditDateInput("");
      await loadData();
      fireAndForgetSync();
    } catch (caught) {
      setError(userMessage(caught));
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────

  const onDeleteCycleStart = (entry: CycleStart): void => {
    Alert.alert(
      "Delete Cycle Start",
      `Remove the cycle start on ${entry.startDateIso}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void performDelete(entry.id),
        },
      ],
    );
  };

  const performDelete = async (id: number): Promise<void> => {
    try {
      setError(null);
      await repository.deleteCycleStart(id);
      if (editingId === id) {
        setEditingId(null);
        setEditDateInput("");
      }
      await loadData();
      fireAndForgetSync();
    } catch (caught) {
      setError(userMessage(caught));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <AppText variant="heading" style={styles.title}>
        Cycle Log
      </AppText>
      <AppText variant="subheading" color={colors.textMuted} style={styles.subtitle}>
        {profile ? profile.name : `Profile ${profileId}`}
      </AppText>

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
          {editingId === entry.id ? (
            <View style={styles.editContainer}>
              <AppInput
                label="Edit date"
                value={editDateInput}
                onChangeText={setEditDateInput}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <View style={styles.editActions}>
                <AppButton
                  title="Save"
                  onPress={() => void onSaveEdit()}
                  style={styles.editActionButton}
                />
                <AppButton
                  title="Cancel"
                  variant="ghost"
                  onPress={onCancelEdit}
                  style={styles.editActionButton}
                />
              </View>
            </View>
          ) : (
            <View style={styles.entryRow}>
              <AppText variant="body" style={styles.entryDate}>
                {entry.startDateIso}
              </AppText>
              <View style={styles.entryActions}>
                <AppButton
                  title="Edit"
                  variant="ghost"
                  onPress={() => onStartEdit(entry)}
                />
                <AppButton
                  title="Delete"
                  variant="danger"
                  onPress={() => onDeleteCycleStart(entry)}
                />
              </View>
            </View>
          )}
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
  entryCard: {
    marginBottom: spacing.sm,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  entryDate: {
    flex: 1,
  },
  entryActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  editContainer: {
    gap: spacing.sm,
  },
  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  editActionButton: {
    flex: 1,
  },
  inputRow: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addButton: {
    marginTop: spacing.xs,
  },
});
