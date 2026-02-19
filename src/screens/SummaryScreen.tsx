// TODO: delete in v0.3-5
import type { ReactElement } from "react";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getRepository } from "../db";
import { getAppState, loadActiveProfileId } from "../domain/AppState";
import {
  computeCycleDay,
  estimateNextStart,
  formatIsoDate,
  typicalCycleLength,
} from "../domain/cycleMath";
import {
  requestNotificationPermissions,
  scheduleNextPeriodReminder,
  scheduleTestNotificationInSeconds,
} from "../utils/notifications";
import {
  AppButton,
  AppCard,
  AppText,
  ErrorBanner,
  LoadingIndicator,
  ScreenContainer,
  colors,
  spacing,
} from "../ui";
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

/** @deprecated v0.3-4 — replaced by DashboardScreen. Remove in v0.3-5. */
export function SummaryScreen({ navigation }: Props): ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  const loadPermissionStatus = useCallback(async (): Promise<void> => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationsGranted(permissions.granted);
    } catch {
      setNotificationsGranted(false);
    }
  }, []);

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
      void loadPermissionStatus();
    }, [loadPermissionStatus, loadSummary])
  );

  const onEnableNotifications = async (): Promise<void> => {
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsGranted(granted);
      setNotificationMessage(granted ? "Notifications enabled." : "Notifications permission denied.");
    } catch {
      setNotificationsGranted(false);
      setNotificationMessage("Failed to request notification permissions.");
    }
  };

  const onScheduleTestNotification = async (): Promise<void> => {
    try {
      const identifier = await scheduleTestNotificationInSeconds(120);
      setNotificationMessage(`Scheduled test notification id: ${identifier}`);
      await loadPermissionStatus();
    } catch (caught) {
      if (caught instanceof Error) {
        setNotificationMessage(caught.message);
      } else {
        setNotificationMessage("Failed to schedule test notification.");
      }
      await loadPermissionStatus();
    }
  };

  const onScheduleNextPeriodReminder = async (): Promise<void> => {
    if (!summary?.nextStartEstimate) {
      setNotificationMessage("No next start estimate available yet.");
      return;
    }

    try {
      const identifier = await scheduleNextPeriodReminder(summary.nextStartEstimate, 2);
      setNotificationMessage(`Scheduled reminder id: ${identifier}`);
      await loadPermissionStatus();
    } catch (caught) {
      if (caught instanceof Error) {
        setNotificationMessage(caught.message);
      } else {
        setNotificationMessage("Failed to schedule next period reminder.");
      }
      await loadPermissionStatus();
    }
  };

  return (
    <ScreenContainer>
      <AppText variant="heading" style={styles.title}>
        Summary
      </AppText>

      <AppButton
        title="Back"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      />

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}

      {notificationsGranted === false ? (
        <ErrorBanner message="Notifications are not enabled." />
      ) : null}

      {notificationMessage ? (
        <AppCard style={styles.notifCard}>
          <AppText variant="caption" color={colors.secondary}>
            {notificationMessage}
          </AppText>
        </AppCard>
      ) : null}

      {/* Notification actions */}
      <View style={styles.notifRow}>
        <AppButton
          title="Enable notifications"
          variant="secondary"
          onPress={() => {
            void onEnableNotifications();
          }}
          style={styles.notifButton}
        />
        <AppButton
          title="Test (2 min)"
          variant="secondary"
          onPress={() => {
            void onScheduleTestNotification();
          }}
          style={styles.notifButton}
        />
      </View>

      {summary ? (
        <AppCard style={styles.summaryCard}>
          <AppText variant="subheading" style={styles.summaryTitle}>
            {summary.profileName}
          </AppText>

          <View style={styles.dataRow}>
            <AppText variant="label">Last Start</AppText>
            <AppText variant="body">{summary.lastStart ?? "—"}</AppText>
          </View>

          <View style={styles.dataRow}>
            <AppText variant="label">Cycle Day</AppText>
            <AppText variant="number" color={colors.primary}>
              {summary.cycleDay ?? "—"}
            </AppText>
          </View>

          <View style={styles.dataRow}>
            <AppText variant="label">Typical Length</AppText>
            <AppText variant="body">
              {summary.typicalLen !== null ? `${summary.typicalLen} days` : "—"}
            </AppText>
          </View>

          <View style={styles.dataRow}>
            <AppText variant="label">Next Estimate</AppText>
            <AppText variant="body">{summary.nextStartEstimate ?? "—"}</AppText>
          </View>

          {summary.nextStartEstimate ? (
            <AppButton
              title="Schedule reminder 2 days before"
              variant="primary"
              onPress={() => {
                void onScheduleNextPeriodReminder();
              }}
              style={styles.reminderButton}
            />
          ) : null}

          {summary.sortedStartDates.length < 2 ? (
            <AppText variant="caption" style={styles.hint}>
              Add at least two cycle starts to see estimates.
            </AppText>
          ) : null}
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xs,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  notifCard: {
    marginBottom: spacing.sm,
  },
  notifRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  notifButton: {
    flex: 1,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryTitle: {
    marginBottom: spacing.xs,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reminderButton: {
    marginTop: spacing.md,
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.md,
  },
});
