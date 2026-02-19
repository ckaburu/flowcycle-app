import type { NotificationPlan, ReminderItem } from "./notificationPlan";
import type { NotificationAdapter } from "../utils/notificationAdapter";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type SyncLogger = {
  onSchedule(item: ReminderItem): void;
  onCancel(id: string): void;
  onSkip(item: ReminderItem, reason: string): void;
  onError(action: string, id: string, error: unknown): void;
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * Parse an ISO date string (YYYY-MM-DD) into a local Date at 09:00.
 *
 * Uses the `new Date(year, month, day, hour)` constructor which interprets
 * arguments in the device's local timezone — exactly what we want for
 * scheduling a notification that fires at 9 AM local time.
 *
 * Pure helper — no Expo imports.
 */
export function parseIsoLocalDateAtNine(iso: string): Date {
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  return new Date(
    Number(yearRaw),
    Number(monthRaw) - 1,
    Number(dayRaw),
    9,
    0,
    0,
    0,
  );
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────

/**
 * Execute a NotificationPlan against a NotificationAdapter.
 *
 * 1. Cancel all IDs in plan.toCancel
 * 2. Schedule all items in plan.toSchedule
 *
 * Idempotency guarantee: Because IDs are deterministic and
 * Expo's scheduleNotificationAsync with an `identifier` replaces
 * existing notifications with the same ID, calling this function
 * multiple times with the same plan is safe.
 *
 * @param plan    The computed notification plan (pure domain output)
 * @param adapter Platform notification adapter (Expo or Memory)
 * @param logger  Optional DEV-only logger for debugging scheduling decisions
 * @param now     Current timestamp in ms — injectable for testing (defaults to Date.now())
 */
export async function reconcileScheduledNotifications(
  plan: NotificationPlan,
  adapter: NotificationAdapter,
  logger?: SyncLogger,
  now?: number,
): Promise<void> {
  const currentTime = now ?? Date.now();

  // 1. Cancel stale notifications
  for (const id of plan.toCancel) {
    try {
      await adapter.cancel(id);
      logger?.onCancel(id);
    } catch (err) {
      logger?.onError("cancel", id, err);
    }
  }

  // 2. Schedule new notifications
  for (const item of plan.toSchedule) {
    const fireDate = parseIsoLocalDateAtNine(item.fireDateIso);

    if (fireDate.getTime() <= currentTime) {
      logger?.onSkip(item, "fire date in past");
      continue;
    }

    try {
      await adapter.schedule(item.id, fireDate, item.title, item.body);
      logger?.onSchedule(item);
    } catch (err) {
      logger?.onError("schedule", item.id, err);
    }
  }
}
