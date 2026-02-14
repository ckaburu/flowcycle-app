import * as Notifications from "expo-notifications";
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
import {
  requestNotificationPermissions,
  scheduleNextPeriodReminder,
  scheduleTestNotificationInSeconds,
} from "../utils/notifications";
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
    <View>
      <Text>Summary</Text>
      <Button title="Back" onPress={() => navigation.goBack()} />
      <Button
        title="Enable notifications"
        onPress={() => {
          void onEnableNotifications();
        }}
      />
      <Button
        title="Schedule test notification (2 min)"
        onPress={() => {
          void onScheduleTestNotification();
        }}
      />

      {isLoading ? <Text>Loading...</Text> : null}
      {error ? <Text>{error}</Text> : null}
      {notificationsGranted === false ? <Text>Warning: Notifications are not enabled.</Text> : null}
      {notificationMessage ? <Text>{notificationMessage}</Text> : null}

      {summary ? (
        <View>
          <Text>Profile: {summary.profileName}</Text>
          <Text>Last Start: {summary.lastStart ?? "-"}</Text>
          <Text>Cycle Day: {summary.cycleDay ?? "-"}</Text>
          <Text>
            Typical Cycle Length: {summary.typicalLen !== null ? `${summary.typicalLen} days` : "-"}
          </Text>
          <Text>Next Start Estimate: {summary.nextStartEstimate ?? "-"}</Text>
          {summary.nextStartEstimate ? (
            <Button
              title="Schedule reminder 2 days before"
              onPress={() => {
                void onScheduleNextPeriodReminder();
              }}
            />
          ) : null}
          {summary.sortedStartDates.length < 2 ? (
            <Text>Add at least two cycle starts to see estimates.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
