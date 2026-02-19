/**
 * Platform-agnostic notification scheduling interface.
 * The reconciliation layer depends on this — not on Expo directly.
 */
export interface NotificationAdapter {
  /**
   * Schedule a notification with a deterministic identifier.
   * If a notification with this ID already exists, it is replaced.
   *
   * @param id    Deterministic identifier (e.g., "fc-remind-1-2026-03-15")
   * @param fireDate  Date object — when the notification should fire
   * @param title     Notification title
   * @param body      Notification body text
   */
  schedule(id: string, fireDate: Date, title: string, body: string): Promise<void>;

  /**
   * Cancel a scheduled notification by its deterministic identifier.
   * No-op if the notification doesn't exist.
   */
  cancel(id: string): Promise<void>;

  /**
   * Cancel all notifications managed by this adapter.
   */
  cancelAll(): Promise<void>;
}
