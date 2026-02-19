import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { NotificationAdapter } from "./notificationAdapter";

let channelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || channelReady) {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
  });
  channelReady = true;
}

/**
 * Production adapter that delegates to expo-notifications.
 *
 * This is the **only file that imports expo-notifications for scheduling**.
 * The reconciliation layer depends on the NotificationAdapter interface,
 * never on this concrete class directly.
 */
export class ExpoNotificationAdapter implements NotificationAdapter {
  async schedule(
    id: string,
    fireDate: Date,
    title: string,
    body: string,
  ): Promise<void> {
    await ensureAndroidChannel();

    await Notifications.scheduleNotificationAsync({
      identifier: id, // deterministic — auto-replaces if exists
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: "default",
      },
    });
  }

  async cancel(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
