import { quickLogCycleStart } from "./quickLogCycleStart";
import type { QuickLogResult } from "./quickLogCycleStart";
import { memoryRepo } from "../db/memoryRepo";

describe("quickLogCycleStart", () => {
  beforeEach(async () => {
    await memoryRepo.clearAllForTesting();
  });

  it("creates a cycle start when none exists for the date", async () => {
    const profile = await memoryRepo.createProfile("Alice");
    const result: QuickLogResult = await quickLogCycleStart(
      profile.id,
      "2026-01-15",
      memoryRepo,
    );

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.cycleStart.profileId).toBe(profile.id);
      expect(result.cycleStart.startDateIso).toBe("2026-01-15");
    }

    // Verify it was actually persisted
    const starts = await memoryRepo.listCycleStarts(profile.id);
    expect(starts).toHaveLength(1);
    expect(starts[0].startDateIso).toBe("2026-01-15");
  });

  it("returns already_exists when date is already logged", async () => {
    const profile = await memoryRepo.createProfile("Alice");
    await memoryRepo.addCycleStart(profile.id, "2026-01-15");

    const result = await quickLogCycleStart(
      profile.id,
      "2026-01-15",
      memoryRepo,
    );

    expect(result.status).toBe("already_exists");

    // Verify no duplicate was created
    const starts = await memoryRepo.listCycleStarts(profile.id);
    expect(starts).toHaveLength(1);
  });

  it("calling twice with same date: first creates, second returns already_exists", async () => {
    const profile = await memoryRepo.createProfile("Alice");

    const first = await quickLogCycleStart(
      profile.id,
      "2026-02-10",
      memoryRepo,
    );
    const second = await quickLogCycleStart(
      profile.id,
      "2026-02-10",
      memoryRepo,
    );

    expect(first.status).toBe("created");
    expect(second.status).toBe("already_exists");

    // Still only one entry
    const starts = await memoryRepo.listCycleStarts(profile.id);
    expect(starts).toHaveLength(1);
  });

  it("works correctly with different profile IDs (profile isolation)", async () => {
    const alice = await memoryRepo.createProfile("Alice");
    const bob = await memoryRepo.createProfile("Bob");

    const aliceResult = await quickLogCycleStart(
      alice.id,
      "2026-03-01",
      memoryRepo,
    );
    const bobResult = await quickLogCycleStart(
      bob.id,
      "2026-03-01",
      memoryRepo,
    );

    // Both should succeed — same date, different profiles
    expect(aliceResult.status).toBe("created");
    expect(bobResult.status).toBe("created");

    const aliceStarts = await memoryRepo.listCycleStarts(alice.id);
    const bobStarts = await memoryRepo.listCycleStarts(bob.id);
    expect(aliceStarts).toHaveLength(1);
    expect(bobStarts).toHaveLength(1);
  });

  it("allows different dates for the same profile", async () => {
    const profile = await memoryRepo.createProfile("Alice");

    const first = await quickLogCycleStart(
      profile.id,
      "2026-01-01",
      memoryRepo,
    );
    const second = await quickLogCycleStart(
      profile.id,
      "2026-02-01",
      memoryRepo,
    );

    expect(first.status).toBe("created");
    expect(second.status).toBe("created");

    const starts = await memoryRepo.listCycleStarts(profile.id);
    expect(starts).toHaveLength(2);
  });
});
