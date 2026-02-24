import { memoryRepo } from "../db/memoryRepo";
import { loadDashboardData } from "./loadDashboardData";

describe("loadDashboardData", () => {
  beforeEach(async () => {
    await memoryRepo.clearAllForTesting();
  });

  it("throws when profile ID does not exist", async () => {
    await expect(loadDashboardData(999, memoryRepo)).rejects.toThrow(
      "Profile not found",
    );
  });

  it("returns null fields when profile has no cycle starts", async () => {
    const profile = await memoryRepo.createProfile("Alice");
    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-15");

    expect(data.profileName).toBe("Alice");
    expect(data.profileId).toBe(profile.id);
    expect(data.cycleDay).toBeNull();
    expect(data.typicalLength).toBeNull();
    expect(data.lastStart).toBeNull();
    expect(data.nextStartEstimate).toBeNull();
    expect(data.startDates).toEqual([]);
  });

  it("returns cycleDay but null typicalLength with only 1 cycle start", async () => {
    const profile = await memoryRepo.createProfile("Bob");
    await memoryRepo.addCycleStart(profile.id, "2026-02-01");

    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-10");

    expect(data.cycleDay).toBe(10); // day 1 = Feb 1, day 10 = Feb 10
    expect(data.lastStart).toBe("2026-02-01");
    expect(data.typicalLength).toBeNull();
    expect(data.nextStartEstimate).toBeNull();
    expect(data.startDates).toEqual(["2026-02-01"]);
  });

  it("returns cycleDay but null prediction with 2 cycle starts (1 interval, below minimum)", async () => {
    const profile = await memoryRepo.createProfile("Carol");
    await memoryRepo.addCycleStart(profile.id, "2026-01-01");
    await memoryRepo.addCycleStart(profile.id, "2026-01-29");

    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-10");

    expect(data.profileName).toBe("Carol");
    expect(data.cycleDay).toBe(13); // Jan 29 → Feb 10 = 13 days
    expect(data.typicalLength).toBeNull();
    expect(data.lastStart).toBe("2026-01-29");
    expect(data.nextStartEstimate).toBeNull();
  });

  it("returns full DashboardData with 3 cycle starts (2 intervals)", async () => {
    const profile = await memoryRepo.createProfile("Carol");
    await memoryRepo.addCycleStart(profile.id, "2025-12-04");
    await memoryRepo.addCycleStart(profile.id, "2026-01-01");
    await memoryRepo.addCycleStart(profile.id, "2026-01-29");

    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-10");

    expect(data.profileName).toBe("Carol");
    expect(data.cycleDay).toBe(13); // Jan 29 → Feb 10 = 13 days
    expect(data.typicalLength).toBe(28); // intervals: 28, 28 → median = 28
    expect(data.lastStart).toBe("2026-01-29");
    expect(data.nextStartEstimate).toBe("2026-02-26"); // Jan 29 + 28 days
  });

  it("uses todayIso override for deterministic day calculation", async () => {
    const profile = await memoryRepo.createProfile("Dana");
    await memoryRepo.addCycleStart(profile.id, "2026-02-01");

    const data1 = await loadDashboardData(profile.id, memoryRepo, "2026-02-01");
    expect(data1.cycleDay).toBe(1);

    const data2 = await loadDashboardData(profile.id, memoryRepo, "2026-02-28");
    expect(data2.cycleDay).toBe(28);
  });

  it("finds lastStart via max-comparison regardless of insertion order", async () => {
    const profile = await memoryRepo.createProfile("Eve");
    // Insert out of order
    await memoryRepo.addCycleStart(profile.id, "2026-02-01");
    await memoryRepo.addCycleStart(profile.id, "2025-12-01");
    await memoryRepo.addCycleStart(profile.id, "2026-01-01");

    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-15");

    expect(data.startDates).toHaveLength(3);
    expect(data.lastStart).toBe("2026-02-01");
  });

  it("computes typical length from multiple cycles using median", async () => {
    const profile = await memoryRepo.createProfile("Fay");
    // 3 cycle starts → 2 lengths: 30 and 28 → median = 29
    await memoryRepo.addCycleStart(profile.id, "2025-12-01");
    await memoryRepo.addCycleStart(profile.id, "2025-12-31"); // 30 days
    await memoryRepo.addCycleStart(profile.id, "2026-01-28"); // 28 days

    const data = await loadDashboardData(profile.id, memoryRepo, "2026-02-10");

    expect(data.typicalLength).toBe(29); // median of [30, 28] = 29
  });
});
