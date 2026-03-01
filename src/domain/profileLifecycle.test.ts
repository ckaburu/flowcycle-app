import { memoryRepo } from "../db/memoryRepo";
import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import { deleteProfileAndReassignActive } from "./profileLifecycle";
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
    async cancelAll() {
      // no-op
    },
  };
}

beforeEach(async () => {
  await repo.clearAllForTesting();
  // Clear mock store
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
});

describe("deleteProfileAndReassignActive", () => {
  it("deletes profile and its cycle starts", async () => {
    const profile = await repo.createProfile("ToDelete");
    await repo.addCycleStart(profile.id, "2026-01-01");
    await repo.addCycleStart(profile.id, "2026-02-01");
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, profile.id);

    const profiles = await repo.listProfiles();
    const cycles = await repo.listCycleStarts(profile.id);
    expect(profiles).toHaveLength(0);
    expect(cycles).toHaveLength(0);
  });

  it("deletes profile and its notification preference", async () => {
    const profile = await repo.createProfile("WithPref");
    await repo.setNotificationPreference(profile.id, true, 2);
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, profile.id);

    const pref = await repo.getNotificationPreference(profile.id);
    expect(pref).toBeNull();
  });

  it("reassigns active to lowest id when active profile is deleted", async () => {
    const p1 = await repo.createProfile("First");
    const p2 = await repo.createProfile("Second");
    const _p3 = await repo.createProfile("Third");
    await saveActiveProfileId(p2.id);
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, p2.id);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);

    const remaining = await repo.listProfiles();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.name).sort()).toEqual(["First", "Third"]);
  });

  it("clears active when last profile is deleted", async () => {
    const profile = await repo.createProfile("OnlyOne");
    await saveActiveProfileId(profile.id);
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, profile.id);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBeNull();
  });

  it("does not change active when deleting non-active profile", async () => {
    const p1 = await repo.createProfile("Active");
    const p2 = await repo.createProfile("Inactive");
    await saveActiveProfileId(p1.id);
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, p2.id);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);
  });

  it("triggers notification sync after delete", async () => {
    const p1 = await repo.createProfile("Remaining");
    const p2 = await repo.createProfile("ToDelete");
    await repo.setNotificationPreference(p1.id, true, 1);
    await repo.setNotificationPreference(p2.id, true, 2);
    await repo.addCycleStart(p1.id, "2026-01-01");
    await repo.addCycleStart(p1.id, "2026-01-29");
    await saveActiveProfileId(p1.id);

    const adapter = createMockAdapter();
    await deleteProfileAndReassignActive(repo, adapter, p2.id);

    // Deleted profile's pref is gone — no schedule calls for p2
    const p2Calls = adapter.scheduleCalls.filter(
      (c) => c.id.includes(`-${p2.id}-`),
    );
    expect(p2Calls).toHaveLength(0);
  });

  it("reassigns to lowest id even when higher-id profiles exist", async () => {
    const p1 = await repo.createProfile("Alpha");
    const _p2 = await repo.createProfile("Beta");
    const p3 = await repo.createProfile("Gamma");
    await saveActiveProfileId(p3.id);
    const adapter = createMockAdapter();

    await deleteProfileAndReassignActive(repo, adapter, p3.id);

    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);
  });

  it("does not throw when notification sync fails, still deletes and reassigns", async () => {
    const p1 = await repo.createProfile("Survivor");
    const p2 = await repo.createProfile("ToDelete");
    await saveActiveProfileId(p2.id);

    const spy = jest.spyOn(syncModule, "syncNotifications")
      .mockRejectedValueOnce(new Error("adapter crash"));

    const adapter = createMockAdapter();
    // Must not throw
    await deleteProfileAndReassignActive(repo, adapter, p2.id);

    // Profile was deleted
    const profiles = await repo.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Survivor");

    // Active was reassigned despite sync failure
    const activeId = await loadActiveProfileId();
    expect(activeId).toBe(p1.id);

    spy.mockRestore();
  });
});
