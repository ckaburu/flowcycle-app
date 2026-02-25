import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { getRepository } from "../db";
import { CycleStart, Profile } from "../db/repo";
import { computeEntryMeta } from "../domain/cycleMath";
import { DeferredDelete } from "../domain/deferredDelete";
import { DuplicateCycleStartError, FutureDateError } from "../domain/errors";
import { syncNotifications } from "../domain/syncNotifications";
import { devSyncLogger } from "../domain/devSyncLogger";
import { ExpoNotificationAdapter } from "../utils/expoNotificationAdapter";
import { isValidIsoDate, localDateToIso, isoToLocalDate } from "../utils/date";
import {
  AppButton,
  AppCard,
  AppText,
  EmptyState,
  ErrorBanner,
  LoadingIndicator,
  ProfileAvatar,
  ScreenContainer,
  colors,
  radii,
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

  // Deferred delete: entry is hidden from UI but not yet removed from DB
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const commitDeleteRef = useRef<(id: number) => void>(() => {});
  const deferredRef = useRef<DeferredDelete | null>(null);
  if (deferredRef.current === null) {
    deferredRef.current = new DeferredDelete(
      (id) => commitDeleteRef.current(id),
    );
  }

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
      return () => {
        // Flush pending deletion on blur (navigate away) or unmount
        deferredRef.current!.flush();
      };
    }, [loadData])
  );

  // Flush pending deletion when app goes to background
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        deferredRef.current!.flush();
      }
    });
    return () => sub.remove();
  }, []);

  // ── Add ──────────────────────────────────────────────────────────────

  const onAddCycleStart = async (): Promise<void> => {
    if (!startDateInput || !isValidIsoDate(startDateInput)) {
      setError("Please select a date.");
      return;
    }

    try {
      setError(null);
      await repository.addCycleStart(profileId, startDateInput);
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

    if (!editDateInput || !isValidIsoDate(editDateInput)) {
      setError("Please select a date.");
      return;
    }

    try {
      setError(null);
      await repository.updateCycleStart(editingId, editDateInput);
      setEditingId(null);
      setEditDateInput("");
      await loadData();
      fireAndForgetSync();
    } catch (caught) {
      setError(userMessage(caught));
    }
  };

  // ── Delete (deferred with undo) ─────────────────────────────────────

  // Keep commit callback fresh to avoid stale closures in DeferredDelete
  commitDeleteRef.current = (id: number) => {
    setPendingDeleteId(null);
    void (async () => {
      try {
        setError(null);
        await repository.deleteCycleStart(id);
        await loadData();
        fireAndForgetSync();
      } catch (caught) {
        setError(userMessage(caught));
      }
    })();
  };

  const onDeleteCycleStart = (entry: CycleStart): void => {
    if (editingId === entry.id) {
      setEditingId(null);
      setEditDateInput("");
    }
    setPendingDeleteId(entry.id);
    deferredRef.current!.request(entry.id);
  };

  const handleUndo = (): void => {
    if (deferredRef.current!.undo()) {
      setPendingDeleteId(null);
    }
  };

  // ── Date picker ───────────────────────────────────────────────────────

  const [pickerTarget, setPickerTarget] = useState<"add" | "edit" | null>(null);

  const pickerValue = useMemo((): Date => {
    const iso = pickerTarget === "add" ? startDateInput : editDateInput;
    if (iso && isValidIsoDate(iso)) {
      return isoToLocalDate(iso);
    }
    return new Date();
  }, [pickerTarget, startDateInput, editDateInput]);

  const handlePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      const target = pickerTarget;
      setPickerTarget(null);
      if (event.type === "set" && selectedDate && target) {
        const iso = localDateToIso(selectedDate);
        if (target === "add") {
          setStartDateInput(iso);
        } else {
          setEditDateInput(iso);
        }
      }
    },
    [pickerTarget],
  );

  // ── Render ───────────────────────────────────────────────────────────

  const visibleEntries = cycleStarts.filter(
    (entry) => entry.id !== pendingDeleteId,
  );
  const pendingEntry =
    pendingDeleteId !== null
      ? cycleStarts.find((e) => e.id === pendingDeleteId) ?? null
      : null;

  // Cycle number + interval metadata for each entry (sorted by date ascending)
  const entryMeta = useMemo(() => computeEntryMeta(cycleStarts), [cycleStarts]);

  return (
    <ScreenContainer>
      <AppText variant="heading" style={styles.title}>
        Cycle Log
      </AppText>
      {profile ? (
        <View style={styles.subtitleRow}>
          <ProfileAvatar name={profile.name} size={24} />
          <AppText variant="subheading" color={colors.textMuted}>
            {profile.name}
          </AppText>
        </View>
      ) : (
        <AppText variant="subheading" color={colors.textMuted} style={styles.subtitle}>
          Profile {profileId}
        </AppText>
      )}

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      ) : null}

      {pendingEntry && (
        <View style={styles.undoBar}>
          <AppText variant="body" style={styles.undoText}>
            Removed {pendingEntry.startDateIso}
          </AppText>
          <AppButton title="Undo" variant="ghost" onPress={handleUndo} />
        </View>
      )}

      {isLoading ? <LoadingIndicator /> : null}

      {!isLoading && visibleEntries.length === 0 && pendingDeleteId === null ? (
        <EmptyState
          message="No cycle starts yet."
          hint="Add your first cycle start date below."
        />
      ) : null}

      {visibleEntries.map((entry) => (
        <AppCard key={entry.id} style={styles.entryCard}>
          {editingId === entry.id ? (
            <View style={styles.editContainer}>
              <View>
                <AppText variant="label" style={styles.dateFieldLabel}>
                  Edit date
                </AppText>
                <Pressable
                  style={styles.dateField}
                  onPress={() => setPickerTarget("edit")}
                  accessibilityRole="button"
                  accessibilityLabel="Select edit date"
                >
                  <AppText variant="body">
                    {editDateInput}
                  </AppText>
                </Pressable>
              </View>
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
            <View>
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
              {(() => {
                const meta = entryMeta.get(entry.id);
                if (!meta) return null;
                const label = meta.intervalDays !== null
                  ? `Cycle #${meta.cycleNumber} · ${meta.intervalDays} days`
                  : `Cycle #${meta.cycleNumber}`;
                return (
                  <AppText variant="caption" color={colors.textMuted} style={styles.entryCaption}>
                    {label}
                  </AppText>
                );
              })()}
            </View>
          )}
        </AppCard>
      ))}

      <View style={styles.inputRow}>
        <View>
          <AppText variant="label" style={styles.dateFieldLabel}>
            Start date
          </AppText>
          <Pressable
            style={styles.dateField}
            onPress={() => setPickerTarget("add")}
            accessibilityRole="button"
            accessibilityLabel="Select start date"
          >
            <AppText
              variant="body"
              style={startDateInput ? undefined : styles.dateFieldPlaceholder}
            >
              {startDateInput || "Select date"}
            </AppText>
          </Pressable>
        </View>
        <AppButton
          title="Add Cycle Start"
          onPress={() => {
            void onAddCycleStart();
          }}
          style={styles.addButton}
        />
      </View>

      {pickerTarget !== null && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          maximumDate={new Date()}
          onChange={handlePickerChange}
        />
      )}
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
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginBottom: spacing.sm,
  },
  undoText: {
    color: colors.info,
    flex: 1,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  entryCaption: {
    marginTop: spacing.xs,
  },
  entryActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dateFieldLabel: {
    marginBottom: spacing.xs,
  },
  dateField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: "center",
  },
  dateFieldPlaceholder: {
    color: colors.textMuted,
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
