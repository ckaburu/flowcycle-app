import { memoryRepo } from "../db/memoryRepo";
import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import { reconcileOnLaunch } from "./reconcileOnLaunch";
import { loadActiveProfileId, saveActiveProfileId } from "./AppState";
import * as syncModule from "./syncNotifications";

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
    removeItem: jest.fn(async (key: string) => {
      delete mockStore[key];
    }),
  },
}));

// Pin "today" so syncNotifications computes consistent plans
beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 1, 19, 9, 0, 0, 0) });
});

afterAll(() => {
  jest.useRealTimers();
});

const repo: Repository = memoryRepo;

type ScheduleCall = { id: string; fireDate: Date; title: string; body: string };

function createMockAdapter(): NotificationAdapter & { scheduleCalls: ScheduleCall[]; cancelCalls: string[] } {
  return {
    scheduleCalls: [] as ScheduleCall[],
    cancelCalls: [] as string[],
    async schedule(id, fireDate, title, body) {
      this.scheduleCalls.push({ id, fireDate, title, body });
    },
    async cancel(id) {
      this.cancelCalls.push(id);
    },
    async cancelAll() {},
  };
}

beforeEach(async () => {
  await repo.clearAllForTesting();
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
});

describe("reconcileOnLaunch", () => {
  it("keeps active profile when it exists", async () => {
    const p1 = await repo.createProfile("Alice");
    const _p2 = await repo.createProfile("Bob");
    await saveActiveProfileId(p1.id);
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);
  });

  it("reassigns to lowest id when active profile is missing", async () => {
    const p1 = await repo.createProfile("Alpha");
    const p2 = await repo.createProfile("Beta");
    // Set active to a non-existent id
    await saveActiveProfileId(999);
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);
  });

  it("sets lowest id when no active but profiles exist", async () => {
    const _p1 = await repo.createProfile("First");
    const p2 = await repo.createProfile("Second");
    // No active profile set (mockStore is empty)
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);

    const activeId = await loadActiveProfileId();
    // _p1 has id=1, p2 has id=2 → lowest is 1
    expect(activeId).toBe(1);
  });

  it("clears active when no profiles exist", async () => {
    // Set a stale active id with no profiles
    await saveActiveProfileId(42);
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBeNull();
  });

  it("is idempotent — running twice produces same result", async () => {
    const p1 = await repo.createProfile("Stable");
    await repo.createProfile("Other");
    await saveActiveProfileId(999); // stale
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);
    const afterFirst = await loadActiveProfileId();

    const adapter2 = createMockAdapter();
    await reconcileOnLaunch(repo, adapter2);
    const afterSecond = await loadActiveProfileId();

    expect(afterFirst).toBe(p1.id);
    expect(afterSecond).toBe(p1.id);
  });

  it("triggers notification sync", async () => {
    const p1 = await repo.createProfile("Notified");
    await repo.setNotificationPreference(p1.id, true, 2);
    // Need >= 3 cycle starts so typicalCycleLength has >= 2 intervals
    await repo.addCycleStart(p1.id, "2025-12-05");
    await repo.addCycleStart(p1.id, "2026-01-01");
    await repo.addCycleStart(p1.id, "2026-01-29");
    await saveActiveProfileId(p1.id);
    const adapter = createMockAdapter();

    await reconcileOnLaunch(repo, adapter);

    // syncNotifications ran — adapter received schedule calls for the
    // enabled profile with enough cycle data to predict next start.
    expect(adapter.scheduleCalls.length).toBeGreaterThan(0);
  });

  it("does not throw when syncNotifications fails", async () => {
    const p1 = await repo.createProfile("Survivor");
    await saveActiveProfileId(999); // stale — should be repaired
    const adapter = createMockAdapter();

    const spy = jest.spyOn(syncModule, "syncNotifications")
      .mockRejectedValueOnce(new Error("sync boom"));

    // Must not throw
    await reconcileOnLaunch(repo, adapter);

    // Active profile repair still occurred despite sync failure
    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);

    spy.mockRestore();
  });

  it("repairs missing active and survives adapter failure", async () => {
    const p1 = await repo.createProfile("First");
    await repo.createProfile("Second");
    // No active set — should assign lowest id even when sync throws
    const adapter = createMockAdapter();

    const spy = jest.spyOn(syncModule, "syncNotifications")
      .mockRejectedValueOnce(new Error("adapter down"));

    await reconcileOnLaunch(repo, adapter);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);

    spy.mockRestore();
  });
});
