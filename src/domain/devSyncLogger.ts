import type { SyncLogger } from "./reconcileNotifications";
import type { ReminderItem } from "./notificationPlan";

/**
 * DEV-only structured logger for notification scheduling decisions.
 * Outputs to console with [NotifSync] prefix for easy filtering.
 *
 * Usage in App.tsx bootstrap:
 *   syncNotifications(repo, adapter, __DEV__ ? devSyncLogger : undefined)
 */
export const devSyncLogger: SyncLogger = {
  onSchedule(item: ReminderItem): void {
    console.log(
      `[NotifSync] SCHEDULE id=${item.id} ` +
        `profile="${item.profileName}" target=${item.targetDateIso} ` +
        `fire=${item.fireDateIso} daysBefore=${item.daysBefore}`,
    );
  },

  onCancel(id: string): void {
    console.log(`[NotifSync] CANCEL id=${id}`);
  },

  onSkip(item: ReminderItem, reason: string): void {
    console.warn(
      `[NotifSync] SKIP id=${item.id} reason="${reason}" ` +
        `fire=${item.fireDateIso}`,
    );
  },

  onError(action: string, id: string, error: unknown): void {
    console.error(`[NotifSync] ERROR action=${action} id=${id}`, error);
  },
};
