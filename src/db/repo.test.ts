import { DuplicateCycleStartError, FutureDateError } from "../domain/errors";
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

  // ── Notification Preference tests (v0.4) ──────────────────────────

  it("create preference then read back", async () => {
    const profile = await memoryRepo.createProfile("Eva");
    const pref = await memoryRepo.setNotificationPreference(profile.id, true, 1);

    expect(pref).toEqual({ profileId: profile.id, enabled: true, daysBefore: 1 });

    const read = await memoryRepo.getNotificationPreference(profile.id);
    expect(read).toEqual({ profileId: profile.id, enabled: true, daysBefore: 1 });
  });

  it("update existing preference (upsert)", async () => {
    const profile = await memoryRepo.createProfile("Faye");
    await memoryRepo.setNotificationPreference(profile.id, true, 1);
    const updated = await memoryRepo.setNotificationPreference(profile.id, false, 2);

    expect(updated).toEqual({ profileId: profile.id, enabled: false, daysBefore: 2 });

    const read = await memoryRepo.getNotificationPreference(profile.id);
    expect(read).toEqual({ profileId: profile.id, enabled: false, daysBefore: 2 });
  });

  it("delete preference", async () => {
    const profile = await memoryRepo.createProfile("Gina");
    await memoryRepo.setNotificationPreference(profile.id, true, 1);
    await memoryRepo.deleteNotificationPreference(profile.id);

    const read = await memoryRepo.getNotificationPreference(profile.id);
    expect(read).toBeNull();
  });

  it("list all preferences", async () => {
    const p1 = await memoryRepo.createProfile("Hana");
    const p2 = await memoryRepo.createProfile("Ivy");
    await memoryRepo.setNotificationPreference(p1.id, true, 1);
    await memoryRepo.setNotificationPreference(p2.id, false, 3);

    const all = await memoryRepo.listNotificationPreferences();
    expect(all).toHaveLength(2);
    expect(all).toEqual(
      expect.arrayContaining([
        { profileId: p1.id, enabled: true, daysBefore: 1 },
        { profileId: p2.id, enabled: false, daysBefore: 3 },
      ]),
    );
  });

  it("deleteProfile cascades notification preference", async () => {
    const profile = await memoryRepo.createProfile("Jade");
    await memoryRepo.setNotificationPreference(profile.id, true, 1);

    await memoryRepo.deleteProfile(profile.id);

    const pref = await memoryRepo.getNotificationPreference(profile.id);
    expect(pref).toBeNull();
  });

  it("get non-existent preference returns null", async () => {
    const pref = await memoryRepo.getNotificationPreference(9999);
    expect(pref).toBeNull();
  });

  // ── Cycle mutation tests (v0.4.2) ──────────────────────────────────

  it("addCycleStart rejects duplicate (profileId, startDateIso)", async () => {
    const profile = await memoryRepo.createProfile("Kim");
    await memoryRepo.addCycleStart(profile.id, "2026-01-15");

    await expect(memoryRepo.addCycleStart(profile.id, "2026-01-15")).rejects.toThrow(
      DuplicateCycleStartError,
    );
  });

  it("addCycleStart allows same date for different profiles", async () => {
    const p1 = await memoryRepo.createProfile("Lana");
    const p2 = await memoryRepo.createProfile("Mia");

    await memoryRepo.addCycleStart(p1.id, "2026-01-15");
    const cs2 = await memoryRepo.addCycleStart(p2.id, "2026-01-15");
    expect(cs2.startDateIso).toBe("2026-01-15");
  });

  it("addCycleStart rejects future dates", async () => {
    const profile = await memoryRepo.createProfile("Nina");
    await expect(memoryRepo.addCycleStart(profile.id, "2099-01-01")).rejects.toThrow(
      FutureDateError,
    );
  });

  it("deleteCycleStart removes entry", async () => {
    const profile = await memoryRepo.createProfile("Olivia");
    const cs = await memoryRepo.addCycleStart(profile.id, "2026-01-01");

    await memoryRepo.deleteCycleStart(cs.id);

    const remaining = await memoryRepo.listCycleStarts(profile.id);
    expect(remaining).toHaveLength(0);
  });

  it("deleteCycleStart is idempotent (no error for missing ID)", async () => {
    await expect(memoryRepo.deleteCycleStart(9999)).resolves.toBeUndefined();
  });

  it("updateCycleStart changes date in place", async () => {
    const profile = await memoryRepo.createProfile("Pam");
    const cs = await memoryRepo.addCycleStart(profile.id, "2026-01-01");

    const updated = await memoryRepo.updateCycleStart(cs.id, "2026-01-05");

    expect(updated.id).toBe(cs.id);
    expect(updated.startDateIso).toBe("2026-01-05");

    const list = await memoryRepo.listCycleStarts(profile.id);
    expect(list[0].startDateIso).toBe("2026-01-05");
  });

  it("updateCycleStart to same date is a no-op (no duplicate error)", async () => {
    const profile = await memoryRepo.createProfile("Quinn");
    const cs = await memoryRepo.addCycleStart(profile.id, "2026-01-01");

    const updated = await memoryRepo.updateCycleStart(cs.id, "2026-01-01");
    expect(updated.startDateIso).toBe("2026-01-01");
  });

  it("updateCycleStart rejects duplicate with another entry", async () => {
    const profile = await memoryRepo.createProfile("Rose");
    await memoryRepo.addCycleStart(profile.id, "2026-01-01");
    const cs2 = await memoryRepo.addCycleStart(profile.id, "2026-01-15");

    await expect(memoryRepo.updateCycleStart(cs2.id, "2026-01-01")).rejects.toThrow(
      DuplicateCycleStartError,
    );
  });

  it("updateCycleStart rejects future dates", async () => {
    const profile = await memoryRepo.createProfile("Sara");
    const cs = await memoryRepo.addCycleStart(profile.id, "2026-01-01");

    await expect(memoryRepo.updateCycleStart(cs.id, "2099-01-01")).rejects.toThrow(
      FutureDateError,
    );
  });

  it("updateCycleStart throws for missing entry", async () => {
    await expect(memoryRepo.updateCycleStart(9999, "2026-01-01")).rejects.toThrow(
      "CycleStart not found",
    );
  });

  it("updateCycleStart preserves createdAt", async () => {
    const profile = await memoryRepo.createProfile("Tina");
    const cs = await memoryRepo.addCycleStart(profile.id, "2026-01-01");
    const originalCreatedAt = cs.createdAt;

    const updated = await memoryRepo.updateCycleStart(cs.id, "2026-01-10");
    expect(updated.createdAt).toBe(originalCreatedAt);
  });
});
