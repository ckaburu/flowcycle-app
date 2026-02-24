import { MemoryNotificationAdapter } from "../utils/memoryNotificationAdapter";
import type { NotificationPlan, ReminderItem } from "./notificationPlan";
import { computeNotificationPlan } from "./notificationPlan";
import {
  reconcileScheduledNotifications,
  parseIsoLocalDateAtNine,
  type SyncLogger,
} from "./reconcileNotifications";

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** "now" fixed to 2026-02-19 09:00:00 local */
const NOW = new Date(2026, 1, 19, 9, 0, 0, 0).getTime();

function makeItem(overrides: Partial<ReminderItem> = {}): ReminderItem {
  return {
    id: "fc-remind-1-2026-03-25T09:00",
    profileId: 1,
    profileName: "Alice",
    targetDateIso: "2026-03-26",
    fireDateIso: "2026-03-25",
    daysBefore: 1,
    title: "Period Reminder",
    body: "Alice's period may start in 1 day(s)",
    ...overrides,
  };
}

function makeSyncLogger(): SyncLogger & {
  schedules: ReminderItem[];
  cancels: string[];
  skips: { item: ReminderItem; reason: string }[];
  errors: { action: string; id: string; error: unknown }[];
} {
  const logger = {
    schedules: [] as ReminderItem[],
    cancels: [] as string[],
    skips: [] as { item: ReminderItem; reason: string }[],
    errors: [] as { action: string; id: string; error: unknown }[],
    onSchedule(item: ReminderItem) {
      logger.schedules.push(item);
    },
    onCancel(id: string) {
      logger.cancels.push(id);
    },
    onSkip(item: ReminderItem, reason: string) {
      logger.skips.push({ item, reason });
    },
    onError(action: string, id: string, error: unknown) {
      logger.errors.push({ action, id, error });
    },
  };
  return logger;
}

// ────────────────────────────────────────────
// Category B: Reconciliation Tests
// ────────────────────────────────────────────

describe("reconcileScheduledNotifications", () => {
  let adapter: MemoryNotificationAdapter;

  beforeEach(() => {
    adapter = new MemoryNotificationAdapter();
  });

  it("empty plan → no adapter calls", async () => {
    const plan: NotificationPlan = { toSchedule: [], toCancel: [] };
    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);

    expect(adapter.scheduled.size).toBe(0);
    expect(adapter.cancelled).toEqual([]);
  });

  it("toSchedule only → adapter.schedule called for each item", async () => {
    const item1 = makeItem({ id: "fc-remind-1-2026-03-25T09:00", fireDateIso: "2026-03-25" });
    const item2 = makeItem({
      id: "fc-remind-1-2026-04-22T09:00",
      fireDateIso: "2026-04-22",
      targetDateIso: "2026-04-23",
    });
    const plan: NotificationPlan = { toSchedule: [item1, item2], toCancel: [] };

    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);

    expect(adapter.scheduled.size).toBe(2);
    expect(adapter.scheduled.has("fc-remind-1-2026-03-25T09:00")).toBe(true);
    expect(adapter.scheduled.has("fc-remind-1-2026-04-22T09:00")).toBe(true);
  });

  it("toCancel only → adapter.cancel called for each ID", async () => {
    // Pre-populate adapter
    await adapter.schedule("fc-remind-1-2026-03-01", new Date(), "t", "b");
    await adapter.schedule("fc-remind-1-2026-03-29", new Date(), "t", "b");

    const plan: NotificationPlan = {
      toSchedule: [],
      toCancel: ["fc-remind-1-2026-03-01", "fc-remind-1-2026-03-29"],
    };

    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);

    expect(adapter.scheduled.size).toBe(0);
    expect(adapter.cancelled).toContain("fc-remind-1-2026-03-01");
    expect(adapter.cancelled).toContain("fc-remind-1-2026-03-29");
  });

  it("mixed plan → cancels execute before schedules", async () => {
    const callOrder: string[] = [];
    const spyAdapter: MemoryNotificationAdapter = new MemoryNotificationAdapter();
    const origSchedule = spyAdapter.schedule.bind(spyAdapter);
    const origCancel = spyAdapter.cancel.bind(spyAdapter);
    spyAdapter.schedule = async (...args) => {
      callOrder.push(`schedule:${args[0]}`);
      return origSchedule(...args);
    };
    spyAdapter.cancel = async (...args) => {
      callOrder.push(`cancel:${args[0]}`);
      return origCancel(...args);
    };

    const item = makeItem({ fireDateIso: "2026-03-25" });
    const plan: NotificationPlan = {
      toSchedule: [item],
      toCancel: ["fc-remind-2-2026-02-20"],
    };

    await reconcileScheduledNotifications(plan, spyAdapter, undefined, NOW);

    // All cancels should appear before any schedules
    const cancelIdx = callOrder.indexOf("cancel:fc-remind-2-2026-02-20");
    const scheduleIdx = callOrder.indexOf("schedule:fc-remind-1-2026-03-25T09:00");
    expect(cancelIdx).toBeLessThan(scheduleIdx);
  });

  it("fire date in the past → item skipped, logger.onSkip called", async () => {
    const logger = makeSyncLogger();
    // fireDateIso is 2026-02-18 → at 9am that is before NOW (2026-02-19 09:00)
    const pastItem = makeItem({
      id: "fc-remind-1-2026-02-18T09:00",
      fireDateIso: "2026-02-18",
      targetDateIso: "2026-02-19",
    });
    const plan: NotificationPlan = { toSchedule: [pastItem], toCancel: [] };

    await reconcileScheduledNotifications(plan, adapter, logger, NOW);

    expect(adapter.scheduled.size).toBe(0);
    expect(logger.skips).toHaveLength(1);
    expect(logger.skips[0].reason).toBe("fire date in past");
    expect(logger.skips[0].item.id).toBe("fc-remind-1-2026-02-18T09:00");
  });

  it("fire date equals now exactly → item skipped (<=)", async () => {
    const logger = makeSyncLogger();
    // Create item whose fireDate at 9am local == NOW
    const nowItem = makeItem({
      id: "fc-remind-1-2026-02-19T09:00",
      fireDateIso: "2026-02-19",
      targetDateIso: "2026-02-20",
    });
    const plan: NotificationPlan = { toSchedule: [nowItem], toCancel: [] };

    await reconcileScheduledNotifications(plan, adapter, logger, NOW);

    expect(adapter.scheduled.size).toBe(0);
    expect(logger.skips).toHaveLength(1);
  });

  it("adapter.schedule throws → error logged, continues with next", async () => {
    const logger = makeSyncLogger();
    const throwAdapter = new MemoryNotificationAdapter();
    let callCount = 0;
    throwAdapter.schedule = async (id, fireDate, title, body) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("schedule failed");
      }
      // Second call succeeds — store it manually
      throwAdapter.scheduled.set(id, { fireDate, title, body });
    };

    const item1 = makeItem({ id: "fc-remind-1-2026-03-25T09:00", fireDateIso: "2026-03-25" });
    const item2 = makeItem({
      id: "fc-remind-1-2026-04-22T09:00",
      fireDateIso: "2026-04-22",
      targetDateIso: "2026-04-23",
    });
    const plan: NotificationPlan = { toSchedule: [item1, item2], toCancel: [] };

    await reconcileScheduledNotifications(plan, throwAdapter, logger, NOW);

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0].action).toBe("schedule");
    expect(logger.errors[0].id).toBe("fc-remind-1-2026-03-25T09:00");
    // Second item was still scheduled
    expect(throwAdapter.scheduled.has("fc-remind-1-2026-04-22T09:00")).toBe(true);
  });

  it("adapter.cancel throws → error logged, continues with next", async () => {
    const logger = makeSyncLogger();
    const throwAdapter = new MemoryNotificationAdapter();
    let callCount = 0;
    throwAdapter.cancel = async (id) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("cancel failed");
      }
      throwAdapter.scheduled.delete(id);
      throwAdapter.cancelled.push(id);
    };

    const plan: NotificationPlan = {
      toSchedule: [],
      toCancel: ["fc-remind-1-2026-03-01", "fc-remind-1-2026-03-29"],
    };

    await reconcileScheduledNotifications(plan, throwAdapter, logger, NOW);

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0].action).toBe("cancel");
    expect(logger.errors[0].id).toBe("fc-remind-1-2026-03-01");
    // Second cancel still executed
    expect(throwAdapter.cancelled).toContain("fc-remind-1-2026-03-29");
  });

  it("logger receives onSchedule events with correct items", async () => {
    const logger = makeSyncLogger();
    const item = makeItem({ fireDateIso: "2026-03-25" });
    const plan: NotificationPlan = { toSchedule: [item], toCancel: [] };

    await reconcileScheduledNotifications(plan, adapter, logger, NOW);

    expect(logger.schedules).toHaveLength(1);
    expect(logger.schedules[0].id).toBe("fc-remind-1-2026-03-25T09:00");
    expect(logger.schedules[0].profileName).toBe("Alice");
  });

  it("logger receives onCancel events with correct IDs", async () => {
    const logger = makeSyncLogger();
    const plan: NotificationPlan = {
      toSchedule: [],
      toCancel: ["fc-remind-1-2026-03-01"],
    };

    await reconcileScheduledNotifications(plan, adapter, logger, NOW);

    expect(logger.cancels).toHaveLength(1);
    expect(logger.cancels[0]).toBe("fc-remind-1-2026-03-01");
  });

  it("no logger → runs without error", async () => {
    const item = makeItem({ fireDateIso: "2026-03-25" });
    const plan: NotificationPlan = {
      toSchedule: [item],
      toCancel: ["fc-remind-2-old"],
    };

    // Should not throw when logger is undefined
    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);

    expect(adapter.scheduled.size).toBe(1);
  });
});

// ────────────────────────────────────────────
// parseIsoLocalDateAtNine
// ────────────────────────────────────────────

describe("parseIsoLocalDateAtNine", () => {
  it("returns Date at 09:00 local for given ISO date", () => {
    const d = parseIsoLocalDateAtNine("2026-03-25");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // March = 2
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

// ────────────────────────────────────────────
// Category C: Idempotency Tests
// ────────────────────────────────────────────

describe("idempotency", () => {
  const threeCycles = ["2026-01-01", "2026-01-29", "2026-02-26"];
  const todayIso = "2026-02-19";

  function buildPlanForProfiles(existingIds: string[]) {
    return computeNotificationPlan(
      [
        {
          profileId: 1,
          profileName: "Alice",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
      ],
      existingIds,
      todayIso,
      1,
    );
  }

  it("apply same plan twice → second reconcile has nothing to do", async () => {
    const adapter = new MemoryNotificationAdapter();

    // First: compute and reconcile
    const plan1 = buildPlanForProfiles([]);
    expect(plan1.toSchedule.length).toBeGreaterThan(0);
    await reconcileScheduledNotifications(plan1, adapter, undefined, NOW);

    // Second: compute with existing IDs from adapter
    const existingIds = [...adapter.scheduled.keys()];
    const plan2 = buildPlanForProfiles(existingIds);

    expect(plan2.toSchedule).toEqual([]);
    expect(plan2.toCancel).toEqual([]);
  });

  it("apply plan twice via adapter → no duplicates in scheduled map", async () => {
    const adapter = new MemoryNotificationAdapter();

    const plan = buildPlanForProfiles([]);
    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);
    const sizeAfterFirst = adapter.scheduled.size;

    // Run reconcile again with the same plan (simulates replaying toSchedule)
    await reconcileScheduledNotifications(plan, adapter, undefined, NOW);
    const sizeAfterSecond = adapter.scheduled.size;

    // MemoryNotificationAdapter uses Map.set so same ID overwrites, no growth
    expect(sizeAfterSecond).toBe(sizeAfterFirst);
  });

  it("remove one item → only that item cancelled", async () => {
    const adapter = new MemoryNotificationAdapter();

    // Setup: two profiles, each with one reminder
    const plan1 = computeNotificationPlan(
      [
        {
          profileId: 1,
          profileName: "Alice",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
        {
          profileId: 2,
          profileName: "Bob",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
      ],
      [],
      todayIso,
      1,
    );
    await reconcileScheduledNotifications(plan1, adapter, undefined, NOW);

    const existingIds = [...adapter.scheduled.keys()];
    expect(existingIds.length).toBe(2);

    // Now disable Bob (profileId=2)
    const plan2 = computeNotificationPlan(
      [
        {
          profileId: 1,
          profileName: "Alice",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
        {
          profileId: 2,
          profileName: "Bob",
          enabled: false,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
      ],
      existingIds,
      todayIso,
      1,
    );

    expect(plan2.toSchedule).toEqual([]);
    expect(plan2.toCancel).toHaveLength(1);
    expect(plan2.toCancel[0]).toMatch(/fc-remind-2-/);

    await reconcileScheduledNotifications(plan2, adapter, undefined, NOW);
    expect(adapter.scheduled.size).toBe(1);
    // Only Alice's reminder remains
    const remaining = [...adapter.scheduled.keys()];
    expect(remaining[0]).toMatch(/fc-remind-1-/);
  });

  it("add one item → only new item scheduled", async () => {
    const adapter = new MemoryNotificationAdapter();

    // Setup: just Alice
    const plan1 = buildPlanForProfiles([]);
    await reconcileScheduledNotifications(plan1, adapter, undefined, NOW);
    const existingAfterFirst = [...adapter.scheduled.keys()];

    // Now add Bob
    const plan2 = computeNotificationPlan(
      [
        {
          profileId: 1,
          profileName: "Alice",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
        {
          profileId: 2,
          profileName: "Bob",
          enabled: true,
          daysBefore: 1,
          cycleStartDates: threeCycles,
        },
      ],
      existingAfterFirst,
      todayIso,
      1,
    );

    // Only Bob's item should be new
    expect(plan2.toSchedule).toHaveLength(1);
    expect(plan2.toSchedule[0].profileId).toBe(2);
    expect(plan2.toCancel).toEqual([]);

    await reconcileScheduledNotifications(plan2, adapter, undefined, NOW);
    expect(adapter.scheduled.size).toBe(2);
  });

  it("sync→sync→sync with unchanged data → adapter not called after first", async () => {
    const adapter = new MemoryNotificationAdapter();
    const logger = makeSyncLogger();

    // First sync
    const plan1 = buildPlanForProfiles([]);
    await reconcileScheduledNotifications(plan1, adapter, logger, NOW);
    const schedulesAfterFirst = logger.schedules.length;
    expect(schedulesAfterFirst).toBeGreaterThan(0);

    // Second sync — existing IDs already present
    const existingIds2 = [...adapter.scheduled.keys()];
    const plan2 = buildPlanForProfiles(existingIds2);
    const logger2 = makeSyncLogger();
    await reconcileScheduledNotifications(plan2, adapter, logger2, NOW);

    expect(logger2.schedules).toHaveLength(0);
    expect(logger2.cancels).toHaveLength(0);

    // Third sync — still unchanged
    const existingIds3 = [...adapter.scheduled.keys()];
    const plan3 = buildPlanForProfiles(existingIds3);
    const logger3 = makeSyncLogger();
    await reconcileScheduledNotifications(plan3, adapter, logger3, NOW);

    expect(logger3.schedules).toHaveLength(0);
    expect(logger3.cancels).toHaveLength(0);
  });
});
