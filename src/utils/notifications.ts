import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { assertIsoDate } from "./date";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelConfigured = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || channelConfigured) {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelConfigured = true;
}

async function ensurePermissionsGranted(): Promise<void> {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    throw new Error("Notification permissions are not granted.");
  }
}

function parseIsoLocalDateAtNine(iso: string): Date {
  assertIsoDate(iso);
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw), 9, 0, 0, 0);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return requested.granted;
}

export async function scheduleTestNotificationInSeconds(seconds: number): Promise<string> {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("seconds must be greater than zero.");
  }

  await ensureAndroidChannel();
  await ensurePermissionsGranted();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Flowcycle",
      body: "Test reminder fired",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      channelId: "default",
    },
  });
}

export async function scheduleNextPeriodReminder(
  nextStartIso: string,
  daysBefore: number
): Promise<string> {
  if (!Number.isInteger(daysBefore) || daysBefore < 0) {
    throw new Error("daysBefore must be an integer greater than or equal to zero.");
  }

  await ensureAndroidChannel();
  await ensurePermissionsGranted();

  const triggerDate = parseIsoLocalDateAtNine(nextStartIso);
  triggerDate.setDate(triggerDate.getDate() - daysBefore);

  if (triggerDate.getTime() <= Date.now()) {
    throw new Error("Reminder trigger time is in the past.");
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Flowcycle",
      body: `Reminder: estimated next cycle start is ${nextStartIso}.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: "default",
    },
  });
}
