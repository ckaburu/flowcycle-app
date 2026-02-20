import {
  buildNotificationPlan,
  buildTestReminder,
  computeNotificationPlan,
  makeReminderId,
  makeTestReminderId,
  type ProfileNotificationInput,
} from "./notificationPlan";

// ────────────────────────────────────────────
// buildNotificationPlan
// ────────────────────────────────────────────

describe("buildNotificationPlan", () => {
  // 3 cycle starts → typical = 28, last = 2026-02-26
  // next estimated start = 2026-03-26
  const threeCycles = ["2026-01-01", "2026-01-29", "2026-02-26"];
  const todayIso = "2026-02-19";
  const daysBefore = 2;

  it("3 cycles, maxReminders=1 → returns 1 ReminderItem with correct dates", () => {
    const items = buildNotificationPlan(1, "Alice", daysBefore, threeCycles, todayIso, 1);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "fc-remind-1-2026-03-24T09:00",
      profileId: 1,
      profileName: "Alice",
      targetDateIso: "2026-03-26",
      fireDateIso: "2026-03-24",
      daysBefore: 2,
      title: "Period Reminder",
      body: "Alice's period may start in 2 day(s)",
    });
  });

  it("3 cycles, maxReminders=3 → returns 3 ReminderItems, chronologically ordered", () => {
    const items = buildNotificationPlan(1, "Alice", daysBefore, threeCycles, todayIso, 3);

    expect(items).toHaveLength(3);
    // Cycle 1: 2026-02-26 + 28 = 2026-03-26
    expect(items[0].targetDateIso).toBe("2026-03-26");
    expect(items[0].fireDateIso).toBe("2026-03-24");
    // Cycle 2: 2026-03-26 + 28 = 2026-04-23
    expect(items[1].targetDateIso).toBe("2026-04-23");
    expect(items[1].fireDateIso).toBe("2026-04-21");
    // Cycle 3: 2026-04-23 + 28 = 2026-05-21
    expect(items[2].targetDateIso).toBe("2026-05-21");
    expect(items[2].fireDateIso).toBe("2026-05-19");

    // All items should be chronologically ordered
    for (let i = 1; i < items.length; i++) {
      expect(items[i].fireDateIso > items[i - 1].fireDateIso).toBe(true);
    }
  });

  it("1 cycle start → returns empty array", () => {
    const items = buildNotificationPlan(1, "Alice", daysBefore, ["2026-01-01"], todayIso, 1);
    expect(items).toEqual([]);
  });

  it("0 cycle starts → returns empty array", () => {
    const items = buildNotificationPlan(1, "Alice", daysBefore, [], todayIso, 1);
    expect(items).toEqual([]);
  });

  it("fire date in the past → item excluded", () => {
    // Cycle data from far in the past: typical=28, next=2025-11-26, fire=2025-11-24
    const oldCycles = ["2025-10-01", "2025-10-29"];
    const items = buildNotificationPlan(1, "Alice", daysBefore, oldCycles, todayIso, 1);
    expect(items).toEqual([]);
  });

  it("fire date exactly today → item included", () => {
    // Construct cycle data so fire date lands on todayIso
    // today = 2026-02-19, daysBefore = 2, target must be 2026-02-21
    // typical = 28, lastStart must be 2026-01-24 (2026-01-24 + 28 = 2026-02-21)
    const cycles = ["2025-12-27", "2026-01-24"];
    const items = buildNotificationPlan(1, "Alice", daysBefore, cycles, todayIso, 1);
    expect(items).toHaveLength(1);
    expect(items[0].fireDateIso).toBe("2026-02-19");
  });

  it("notification content matches expected format", () => {
    const items = buildNotificationPlan(2, "Luna", 3, threeCycles, todayIso, 1);

    expect(items[0].title).toBe("Period Reminder");
    expect(items[0].body).toBe("Luna's period may start in 3 day(s)");
  });

  it("timezone-shift: ISO date math uses UTC — no DST drift", () => {
    // Cycle straddles DST boundary (March clocks change in many timezones)
    // Domain uses UTC-only math, so no drift should occur
    const dstCycles = ["2026-02-08", "2026-03-08"];
    // typical = 28, next = 2026-04-05, fire = 2026-04-03
    const items = buildNotificationPlan(1, "Alice", 2, dstCycles, "2026-03-10", 1);

    expect(items).toHaveLength(1);
    expect(items[0].targetDateIso).toBe("2026-04-05");
    expect(items[0].fireDateIso).toBe("2026-04-03");
  });
});

// ────────────────────────────────────────────
// makeReminderId
// ────────────────────────────────────────────

describe("makeReminderId", () => {
  it("same inputs produce same ID (deterministic)", () => {
    const id1 = makeReminderId(1, "2026-03-24");
    const id2 = makeReminderId(1, "2026-03-24");
    expect(id1).toBe(id2);
    expect(id1).toBe("fc-remind-1-2026-03-24T09:00");
  });

  it("different profileId produces different ID", () => {
    const id1 = makeReminderId(1, "2026-03-24");
    const id2 = makeReminderId(2, "2026-03-24");
    expect(id1).not.toBe(id2);
  });

  it("different fireDate produces different ID", () => {
    const id1 = makeReminderId(1, "2026-03-24");
    const id2 = makeReminderId(1, "2026-04-21");
    expect(id1).not.toBe(id2);
  });

  it("same profile + same date + different time → different ID", () => {
    const id1 = makeReminderId(1, "2026-03-24", "09:00");
    const id2 = makeReminderId(1, "2026-03-24", "18:00");
    expect(id1).not.toBe(id2);
    expect(id1).toBe("fc-remind-1-2026-03-24T09:00");
    expect(id2).toBe("fc-remind-1-2026-03-24T18:00");
  });
});

// ────────────────────────────────────────────
// computeNotificationPlan
// ────────────────────────────────────────────

describe("computeNotificationPlan", () => {
  const todayIso = "2026-02-19";
  const threeCycles = ["2026-01-01", "2026-01-29", "2026-02-26"];

  const enabledProfile: ProfileNotificationInput = {
    profileId: 1,
    profileName: "Alice",
    enabled: true,
    daysBefore: 2,
    cycleStartDatesAsc: threeCycles,
  };

  it("new item appears in toSchedule", () => {
    const plan = computeNotificationPlan([enabledProfile], [], todayIso, 1);

    expect(plan.toSchedule).toHaveLength(1);
    expect(plan.toSchedule[0].id).toBe("fc-remind-1-2026-03-24T09:00");
    expect(plan.toCancel).toEqual([]);
  });

  it("stale item appears in toCancel", () => {
    const staleId = "fc-remind-1-2026-02-01"; // old, no longer desired
    const plan = computeNotificationPlan([enabledProfile], [staleId], todayIso, 1);

    expect(plan.toCancel).toEqual([staleId]);
    expect(plan.toSchedule).toHaveLength(1);
  });

  it("unchanged item appears in neither toSchedule nor toCancel", () => {
    const currentId = "fc-remind-1-2026-03-24T09:00"; // matches what buildNotificationPlan produces
    const plan = computeNotificationPlan([enabledProfile], [currentId], todayIso, 1);

    expect(plan.toSchedule).toEqual([]);
    expect(plan.toCancel).toEqual([]);
  });

  it("disabled profile is excluded from plan", () => {
    const disabled: ProfileNotificationInput = {
      ...enabledProfile,
      enabled: false,
    };
    const plan = computeNotificationPlan([disabled], [], todayIso, 1);

    expect(plan.toSchedule).toEqual([]);
    expect(plan.toCancel).toEqual([]);
  });

  it("disabled profile causes existing IDs to be cancelled", () => {
    const disabled: ProfileNotificationInput = {
      ...enabledProfile,
      enabled: false,
    };
    const existingId = "fc-remind-1-2026-03-24T09:00";
    const plan = computeNotificationPlan([disabled], [existingId], todayIso, 1);

    expect(plan.toSchedule).toEqual([]);
    expect(plan.toCancel).toEqual([existingId]);
  });

  it("multiple profiles aggregate correctly", () => {
    const profileB: ProfileNotificationInput = {
      profileId: 2,
      profileName: "Luna",
      enabled: true,
      daysBefore: 3,
      cycleStartDatesAsc: ["2026-01-05", "2026-02-02", "2026-03-02"],
    };

    const plan = computeNotificationPlan(
      [enabledProfile, profileB],
      [],
      todayIso,
      1,
    );

    expect(plan.toSchedule).toHaveLength(2);
    const ids = plan.toSchedule.map((item) => item.id);
    expect(ids).toContain("fc-remind-1-2026-03-24T09:00");
    expect(ids).toContain("fc-remind-2-2026-03-27T09:00");
    expect(plan.toCancel).toEqual([]);
  });

  it("idempotent: same inputs twice produce identical plans", () => {
    const plan1 = computeNotificationPlan([enabledProfile], [], todayIso, 1);
    const plan2 = computeNotificationPlan([enabledProfile], [], todayIso, 1);

    expect(plan1).toEqual(plan2);
  });
});

// ────────────────────────────────────────────
// DEV test helpers
// ────────────────────────────────────────────

describe("makeTestReminderId", () => {
  it("produces fc-test-{profileId}-{ISO}T{HH:mm:ss} format", () => {
    const fireDate = new Date(2026, 1, 20, 14, 30, 45); // 2026-02-20 14:30:45
    const id = makeTestReminderId(1, fireDate);
    expect(id).toBe("fc-test-1-2026-02-20T14:30:45");
  });

  it("zero-pads single-digit hours/minutes/seconds", () => {
    const fireDate = new Date(2026, 0, 5, 9, 5, 3); // 2026-01-05 09:05:03
    const id = makeTestReminderId(2, fireDate);
    expect(id).toBe("fc-test-2-2026-01-05T09:05:03");
  });

  it("same inputs produce same ID (deterministic)", () => {
    const d = new Date(2026, 1, 20, 10, 0, 0);
    expect(makeTestReminderId(1, d)).toBe(makeTestReminderId(1, d));
  });
});

describe("buildTestReminder", () => {
  const now = new Date(2026, 1, 20, 14, 0, 0); // 2026-02-20 14:00:00

  it("returns ReminderItem with fire date = now + delay", () => {
    const item = buildTestReminder(1, "Alice", 30, now);
    // 14:00:00 + 30s = 14:00:30
    expect(item.id).toBe("fc-test-1-2026-02-20T14:00:30");
    expect(item.fireDateIso).toBe("2026-02-20");
    expect(item.daysBefore).toBe(0);
    expect(item.title).toBe("FlowCycle Test");
    expect(item.body).toBe("Test reminder for Alice (30s delay)");
  });

  it("5-second delay produces correct ID", () => {
    const item = buildTestReminder(2, "Bob", 5, now);
    expect(item.id).toBe("fc-test-2-2026-02-20T14:00:05");
  });

  it("carries profileId and profileName through", () => {
    const item = buildTestReminder(42, "Carol", 10, now);
    expect(item.profileId).toBe(42);
    expect(item.profileName).toBe("Carol");
  });
});
