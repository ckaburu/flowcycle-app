import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Alert, InteractionManager, StyleSheet, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { File as ExpoFile, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";

import { isPinSet } from "../domain/LockState";
import { loadActiveProfileId } from "../domain/AppState";
import { exportData } from "../domain/exportData";
import { importData } from "../domain/importData";
import { ImportValidationError } from "../domain/errors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncNotifications } from "../domain/syncNotifications";
import { devSyncLogger } from "../domain/devSyncLogger";
import { buildTestReminder } from "../domain/notificationPlan";
import { getRepository } from "../db";
import { ExpoNotificationAdapter } from "../utils/expoNotificationAdapter";
import { requestNotificationPermissions } from "../utils/notifications";
import { localDateToIso } from "../utils/date";
import type { SettingsStackParamList } from "../navigation/types";
import {
  ListItem,
  SectionHeader,
  ScreenContainer,
  AppText,
  ErrorBanner,
} from "../ui";
import { colors, spacing } from "../ui/tokens";

const appVersion = Constants.expoConfig?.version ?? "unknown";
const DAYS_OPTIONS = [1, 2, 3, 5, 7];

type Props = NativeStackScreenProps<SettingsStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props): ReactElement {
  const [pinSet, setPinSet] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [daysBefore, setDaysBefore] = useState(2);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState("");
  const [dataError, setDataError] = useState("");

  const loadNotifState = useCallback(async (): Promise<void> => {
    const profileId = await loadActiveProfileId();
    setActiveProfileId(profileId);
    if (profileId === null) {
      setActiveProfileName(null);
      setNotifLoading(false);
      return;
    }
    const repo = getRepository();
    const [pref, profiles] = await Promise.all([
      repo.getNotificationPreference(profileId),
      repo.listProfiles(),
    ]);
    const match = profiles.find((p) => p.id === profileId);
    setActiveProfileName(match?.name ?? null);
    if (pref) {
      setNotifEnabled(pref.enabled);
      setDaysBefore(pref.daysBefore);
    } else {
      setNotifEnabled(false);
      setDaysBefore(2);
    }
    setNotifLoading(false);
  }, []);

  const checkPinStatus = useCallback(async (): Promise<void> => {
    const result = await isPinSet();
    setPinSet(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void checkPinStatus();
        void loadNotifState();
      });
      return () => task.cancel();
    }, [checkPinStatus, loadNotifState]),
  );

  const handleToggle = useCallback(
    async (value: boolean): Promise<void> => {
      if (activeProfileId === null) return;
      setNotifError("");

      if (value) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          setNotifError("Enable notifications in system settings");
          return;
        }
      }

      const repo = getRepository();
      await repo.setNotificationPreference(activeProfileId, value, daysBefore);
      setNotifEnabled(value);

      const adapter = new ExpoNotificationAdapter();
      await syncNotifications(
        repo,
        adapter,
        __DEV__ ? devSyncLogger : undefined,
      );
    },
    [activeProfileId, daysBefore],
  );

  const handleCycleDays = useCallback(async (): Promise<void> => {
    if (activeProfileId === null) return;
    const currentIndex = DAYS_OPTIONS.indexOf(daysBefore);
    const nextIndex = (currentIndex + 1) % DAYS_OPTIONS.length;
    const nextDays = DAYS_OPTIONS[nextIndex];

    setDaysBefore(nextDays);
    const repo = getRepository();
    await repo.setNotificationPreference(activeProfileId, notifEnabled, nextDays);

    const adapter = new ExpoNotificationAdapter();
    await syncNotifications(
      repo,
      adapter,
      __DEV__ ? devSyncLogger : undefined,
    );
  }, [activeProfileId, daysBefore, notifEnabled]);

  const handleDevNotification = useCallback(
    async (delaySec: number): Promise<void> => {
      if (activeProfileId === null) return;
      const repo = getRepository();
      const profiles = await repo.listProfiles();
      const profile = profiles.find((p) => p.id === activeProfileId);
      if (!profile) return;

      const item = buildTestReminder(activeProfileId, profile.name, delaySec);
      const adapter = new ExpoNotificationAdapter();
      const fireDate = new Date(Date.now() + delaySec * 1000);
      await adapter.schedule(item.id, fireDate, item.title, item.body);
    },
    [activeProfileId],
  );

  const handleDevCancelAll = useCallback(async (): Promise<void> => {
    const adapter = new ExpoNotificationAdapter();
    await adapter.cancelAll();
    await AsyncStorage.removeItem("flowcycle.trackedNotificationIds");
  }, []);

  const handleExport = useCallback(async (): Promise<void> => {
    setDataError("");
    try {
      const repo = getRepository();
      const bundle = await exportData(repo, appVersion);
      const json = JSON.stringify(bundle, null, 2);
      const dateStr = localDateToIso(new Date());
      const fileName = `flowcycle-export-${dateStr}.json`;
      const file = new ExpoFile(Paths.cache, fileName);
      file.write(json);
      await shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
      });
    } catch {
      setDataError("Export failed. Please try again.");
    }
  }, []);

  const handleImport = useCallback(async (): Promise<void> => {
    setDataError("");
    try {
      const picked = await ExpoFile.pickFileAsync(undefined, "application/json");
      if (!picked) return;
      const file = Array.isArray(picked) ? picked[0] : picked;
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setDataError("File is not valid JSON.");
        return;
      }

      // Confirm before destructive overwrite
      await new Promise<void>((resolve, reject) => {
        Alert.alert(
          "Import Data",
          "This will replace all existing data. This cannot be undone.",
          [
            { text: "Cancel", style: "cancel", onPress: () => reject(new Error("cancelled")) },
            { text: "Import", style: "destructive", onPress: () => resolve() },
          ],
          { cancelable: false },
        );
      });

      const repo = getRepository();
      const adapter = new ExpoNotificationAdapter();
      await importData(
        repo,
        adapter,
        parsed,
        __DEV__ ? devSyncLogger : undefined,
      );

      // Reload settings state to reflect imported data
      void loadNotifState();
    } catch (err) {
      if (err instanceof ImportValidationError) {
        setDataError(err.message);
      } else if (err instanceof Error && err.message === "cancelled") {
        // User cancelled — no error
      } else {
        setDataError("Import failed. Please try again.");
      }
    }
  }, [loadNotifState]);

  return (
    <ScreenContainer>
      <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
        Settings
      </AppText>

      <SectionHeader title="Security" />

      {pinSet ? (
        <>
          <ListItem
            label="Change PIN"
            onPress={() =>
              navigation.navigate("SetupPin", { mode: "change" })
            }
            testID="settings-change-pin"
          />
          <ListItem
            label="Remove PIN"
            onPress={() =>
              navigation.navigate("SetupPin", { mode: "remove" })
            }
            testID="settings-remove-pin"
          />
        </>
      ) : (
        <ListItem
          label="Set PIN"
          onPress={() => navigation.navigate("SetupPin", { mode: "set" })}
          testID="settings-set-pin"
        />
      )}

      {activeProfileId !== null && !notifLoading && (
        <>
          <SectionHeader title="Notifications" />

          {notifError !== "" && (
            <ErrorBanner
              message={notifError}
              onDismiss={() => setNotifError("")}
            />
          )}

          <View style={styles.toggleRow} testID="settings-period-reminders">
            <AppText variant="body" style={styles.toggleLabel}>
              Period Reminders{activeProfileName ? ` (${activeProfileName})` : ""}
            </AppText>
            <Switch
              value={notifEnabled}
              onValueChange={(v) => void handleToggle(v)}
              trackColor={{ true: colors.primary }}
            />
          </View>

          {notifEnabled && (
            <ListItem
              label="Remind me"
              value={`${daysBefore} day${daysBefore !== 1 ? "s" : ""} before`}
              onPress={() => void handleCycleDays()}
              testID="settings-remind-days"
            />
          )}

          {__DEV__ && (
            <>
              <SectionHeader title="Dev Tools" />
              <ListItem
                label="Test notification (5s)"
                onPress={() => void handleDevNotification(5)}
                testID="settings-dev-notif-5s"
              />
              <ListItem
                label="Test notification (30s)"
                onPress={() => void handleDevNotification(30)}
                testID="settings-dev-notif-30s"
              />
              <ListItem
                label="Cancel all notifications"
                onPress={() => void handleDevCancelAll()}
                testID="settings-dev-cancel-all"
              />
            </>
          )}
        </>
      )}

      <SectionHeader title="Data" />

      {dataError !== "" && (
        <ErrorBanner
          message={dataError}
          onDismiss={() => setDataError("")}
        />
      )}

      <ListItem
        label="Export Data"
        onPress={() => void handleExport()}
        testID="settings-export-data"
      />
      <ListItem
        label="Import Data"
        onPress={() => void handleImport()}
        testID="settings-import-data"
      />

      <SectionHeader title="About" />

      <ListItem label="Version" value={appVersion} testID="settings-version" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLabel: {
    flex: 1,
  },
});
