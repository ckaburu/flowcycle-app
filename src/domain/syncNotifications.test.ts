import { memoryRepo } from "../db/memoryRepo";
import { MemoryNotificationAdapter } from "../utils/memoryNotificationAdapter";
import { syncNotifications } from "./syncNotifications";
import type { SyncLogger } from "./reconcileNotifications";
import type { ReminderItem } from "./notificationPlan";

// ────────────────────────────────────────────
// AsyncStorage mock (in-memory)
// ────────────────────────────────────────────

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore[key] = value;
    }),
  },
}));

// ────────────────────────────────────────────
// Fake timers — pin "today" to 2026-02-19 09:00 local
// so formatIsoDate(new Date()) → "2026-02-19"
// and Date.now() → 2026-02-19T09:00 local ms
// ────────────────────────────────────────────

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 1, 19, 9, 0, 0, 0) });
});

afterAll(() => {
  jest.useRealTimers();
});

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

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

/**
 * Seed a profile with cycle starts and notification preference.
 * Returns the profileId.
 */
async function seedProfile(
  name: string,
  cycleDates: string[],
  enabled: boolean,
  daysBefore: number,
): Promise<number> {
  const profile = await memoryRepo.createProfile(name);
  for (const date of cycleDates) {
    await memoryRepo.addCycleStart(profile.id, date);
  }
  await memoryRepo.setNotificationPreference(profile.id, enabled, daysBefore);
  return profile.id;
}

// ────────────────────────────────────────────
// Category D: Integration Tests
// ────────────────────────────────────────────

describe("syncNotifications", () => {
  let adapter: MemoryNotificationAdapter;

  beforeEach(async () => {
    adapter = new MemoryNotificationAdapter();
    await memoryRepo.clearAllForTesting();
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
  });

  it("sync with no prefs → adapter empty", async () => {
    await memoryRepo.createProfile("Alice");
    // No notification preference set

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(0);
  });

  it("sync with enabled pref + cycles → adapter has notification", async () => {
    // Alice: cycles [Jan 1, Jan 29] → typical=28, next=Feb 26, fire=Feb 25
    await seedProfile("Alice", ["2026-01-01", "2026-01-29"], true, 1);

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(1);
    expect(adapter.scheduled.has("fc-remind-1-2026-02-26")).toBe(true);

    const entry = adapter.scheduled.get("fc-remind-1-2026-02-26")!;
    expect(entry.title).toBe("Period Reminder");
    expect(entry.body).toBe("Alice's period may start in 1 day(s)");
  });

  it("sync twice, same data → idempotent (adapter unchanged)", async () => {
    await seedProfile("Alice", ["2026-01-01", "2026-01-29"], true, 1);

    await syncNotifications(memoryRepo, adapter);
    expect(adapter.scheduled.size).toBe(1);

    // Reset cancelled tracker but keep scheduled state
    adapter.cancelled = [];

    await syncNotifications(memoryRepo, adapter);

    // Second sync: plan has toSchedule=[], toCancel=[]
    expect(adapter.scheduled.size).toBe(1);
    expect(adapter.cancelled).toEqual([]);
  });

  it("add cycle start, re-sync → old cancelled, new scheduled", async () => {
    const profileId = await seedProfile(
      "Alice",
      ["2026-01-01", "2026-01-29"],
      true,
      1,
    );

    await syncNotifications(memoryRepo, adapter);
    expect(adapter.scheduled.has("fc-remind-1-2026-02-26")).toBe(true);

    // Add a new cycle start → shifts prediction forward
    // Cycles now: [Jan 1, Jan 29, Feb 26] → typical=28, next=Mar 26, fire=Mar 25
    await memoryRepo.addCycleStart(profileId, "2026-02-26");
    adapter.cancelled = [];

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.cancelled).toContain("fc-remind-1-2026-02-26");
    expect(adapter.scheduled.has("fc-remind-1-2026-03-26")).toBe(true);
    expect(adapter.scheduled.size).toBe(1);
  });

  it("delete profile, re-sync → notification cancelled", async () => {
    const profileId = await seedProfile(
      "Alice",
      ["2026-01-01", "2026-01-29"],
      true,
      1,
    );

    await syncNotifications(memoryRepo, adapter);
    expect(adapter.scheduled.size).toBe(1);

    // deleteProfile cascades prefs + cycle starts in MemoryRepo
    await memoryRepo.deleteProfile(profileId);
    adapter.cancelled = [];

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(0);
    expect(adapter.cancelled).toContain("fc-remind-1-2026-02-26");
  });

  it("disable pref, re-sync → notification cancelled", async () => {
    const profileId = await seedProfile(
      "Alice",
      ["2026-01-01", "2026-01-29"],
      true,
      1,
    );

    await syncNotifications(memoryRepo, adapter);
    expect(adapter.scheduled.size).toBe(1);

    await memoryRepo.setNotificationPreference(profileId, false, 1);
    adapter.cancelled = [];

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(0);
    expect(adapter.cancelled).toContain("fc-remind-1-2026-02-26");
  });

  it("two profiles, both enabled → two notifications", async () => {
    // Alice: typical=28, next=Feb 26, fire=Feb 25
    await seedProfile("Alice", ["2026-01-01", "2026-01-29"], true, 1);
    // Bob: typical=28, next=Mar 2, fire=Feb 28 (daysBefore=2)
    await seedProfile("Bob", ["2026-01-05", "2026-02-02"], true, 2);

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(2);
    expect(adapter.scheduled.has("fc-remind-1-2026-02-26")).toBe(true);
    expect(adapter.scheduled.has("fc-remind-2-2026-03-02")).toBe(true);
  });

  it("logger receives structured events", async () => {
    await seedProfile("Alice", ["2026-01-01", "2026-01-29"], true, 1);
    const logger = makeSyncLogger();

    await syncNotifications(memoryRepo, adapter, logger);

    expect(logger.schedules).toHaveLength(1);
    expect(logger.schedules[0].id).toBe("fc-remind-1-2026-02-26");
    expect(logger.schedules[0].profileName).toBe("Alice");
    expect(logger.cancels).toHaveLength(0);
    expect(logger.skips).toHaveLength(0);
    expect(logger.errors).toHaveLength(0);
  });

  it("tracked IDs persisted to AsyncStorage", async () => {
    await seedProfile("Alice", ["2026-01-01", "2026-01-29"], true, 1);

    await syncNotifications(memoryRepo, adapter);

    const stored = mockStore["flowcycle.trackedNotificationIds"];
    expect(stored).toBeDefined();
    const ids: unknown = JSON.parse(stored);
    expect(ids).toEqual(["fc-remind-1-2026-02-26"]);
  });

  it("profile with insufficient cycle data → no notification", async () => {
    // Only 1 cycle start → typicalCycleLength returns null → no reminders
    await seedProfile("Alice", ["2026-01-15"], true, 1);

    await syncNotifications(memoryRepo, adapter);

    expect(adapter.scheduled.size).toBe(0);
  });
});
