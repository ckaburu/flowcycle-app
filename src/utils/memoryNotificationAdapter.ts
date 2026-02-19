import type { NotificationAdapter } from "./notificationAdapter";

/**
 * In-memory adapter for unit/integration tests.
 * Records all schedule/cancel calls for assertion.
 */
export class MemoryNotificationAdapter implements NotificationAdapter {
  scheduled = new Map<string, { fireDate: Date; title: string; body: string }>();
  cancelled: string[] = [];

  async schedule(id: string, fireDate: Date, title: string, body: string): Promise<void> {
    this.scheduled.set(id, { fireDate, title, body });
  }

  async cancel(id: string): Promise<void> {
    this.scheduled.delete(id);
    this.cancelled.push(id);
  }

  async cancelAll(): Promise<void> {
    const ids = [...this.scheduled.keys()];
    this.scheduled.clear();
    this.cancelled.push(...ids);
  }

  /** Reset for test isolation */
  reset(): void {
    this.scheduled.clear();
    this.cancelled = [];
  }
}
