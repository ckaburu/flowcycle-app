import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { InteractionManager, StyleSheet, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { isPinSet } from "../domain/LockState";
import { loadActiveProfileId } from "../domain/AppState";
import { syncNotifications } from "../domain/syncNotifications";
import { devSyncLogger } from "../domain/devSyncLogger";
import { getRepository } from "../db";
import { ExpoNotificationAdapter } from "../utils/expoNotificationAdapter";
import {
  requestNotificationPermissions,
  scheduleTestNotificationInSeconds,
} from "../utils/notifications";
import type { SettingsStackParamList } from "../navigation/types";
import {
  ListItem,
  SectionHeader,
  ScreenContainer,
  AppText,
  ErrorBanner,
} from "../ui";
import { colors, spacing } from "../ui/tokens";

const DAYS_OPTIONS = [1, 2, 3, 5, 7];

type Props = NativeStackScreenProps<SettingsStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props): ReactElement {
  const [pinSet, setPinSet] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [daysBefore, setDaysBefore] = useState(2);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState("");

  const loadNotifState = useCallback(async (): Promise<void> => {
    const profileId = await loadActiveProfileId();
    setActiveProfileId(profileId);
    if (profileId === null) {
      setNotifLoading(false);
      return;
    }
    const repo = getRepository();
    const pref = await repo.getNotificationPreference(profileId);
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

  const handleTestNotification = useCallback(async (): Promise<void> => {
    await scheduleTestNotificationInSeconds(5);
  }, []);

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
              Period Reminders
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
            <ListItem
              label="🧪 Send Test Notification"
              onPress={() => void handleTestNotification()}
              testID="settings-test-notification"
            />
          )}
        </>
      )}

      <SectionHeader title="About" />

      <ListItem label="Version" value="0.3.0" testID="settings-version" />
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
