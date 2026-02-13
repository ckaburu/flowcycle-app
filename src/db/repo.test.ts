import { memoryRepo } from "./memoryRepo";

describe("memoryRepo", () => {
  beforeEach(async () => {
    await memoryRepo.clearAllForTesting();
  });

  it("createProfile then listProfiles", async () => {
    const created = await memoryRepo.createProfile("Alice");
    const profiles = await memoryRepo.listProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(created.id);
    expect(profiles[0].name).toBe("Alice");
  });

  it("addCycleStart then listCycleStarts", async () => {
    const profile = await memoryRepo.createProfile("Bea");

    const created = await memoryRepo.addCycleStart(profile.id, "2026-02-10");
    const cycleStarts = await memoryRepo.listCycleStarts(profile.id);

    expect(cycleStarts).toHaveLength(1);
    expect(cycleStarts[0].id).toBe(created.id);
    expect(cycleStarts[0].profileId).toBe(profile.id);
    expect(cycleStarts[0].startDateIso).toBe("2026-02-10");
  });

  it("date validation rejects bad inputs", async () => {
    const profile = await memoryRepo.createProfile("Cara");

    await expect(memoryRepo.addCycleStart(profile.id, "02-10-2026")).rejects.toThrow(Error);
    await expect(memoryRepo.addCycleStart(profile.id, "2026-13-10")).rejects.toThrow(Error);
    await expect(memoryRepo.addCycleStart(profile.id, "2026-02-31")).rejects.toThrow(Error);
  });

  it("deleteProfile cascades cycle_starts", async () => {
    const profile = await memoryRepo.createProfile("Dani");
    await memoryRepo.addCycleStart(profile.id, "2026-01-01");
    await memoryRepo.addCycleStart(profile.id, "2026-02-01");

    await memoryRepo.deleteProfile(profile.id);

    const profiles = await memoryRepo.listProfiles();
    const cycleStarts = await memoryRepo.listCycleStarts(profile.id);

    expect(profiles).toHaveLength(0);
    expect(cycleStarts).toHaveLength(0);
  });
});
