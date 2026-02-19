/**
 * Realm Schema Migration Tests (Category F)
 *
 * These tests document the migration scenarios for the Realm schema v1 → v2
 * upgrade introduced in v0.4 (NotificationPreference table).
 *
 * Realm requires native modules (JSI) which are not available in a pure
 * Node.js Jest environment. The automated tests below use MemoryRepo as a
 * contract proxy. The Realm-specific migration scenarios are marked with
 * `it.todo()` and must be verified manually on a device/emulator.
 *
 * See also: `repo.test.ts` for the full MemoryRepo contract tests (Category E).
 * See also: `docs/adr/0006-notification-preferences.md` for migration decisions.
 */

import { memoryRepo } from "./memoryRepo";

describe("schema migration — automated (MemoryRepo proxy)", () => {
  beforeEach(async () => {
    await memoryRepo.clearAllForTesting();
  });

  it("fresh install: all tables accessible, NotificationPreference works", async () => {
    // Simulates fresh install — MemoryRepo starts empty, all methods available
    const profile = await memoryRepo.createProfile("MigrationTest");
    const cycleStart = await memoryRepo.addCycleStart(
      profile.id,
      "2026-03-01",
    );
    const pref = await memoryRepo.setNotificationPreference(
      profile.id,
      true,
      2,
    );

    expect(profile.name).toBe("MigrationTest");
    expect(cycleStart.profileId).toBe(profile.id);
    expect(pref).toEqual({
      profileId: profile.id,
      enabled: true,
      daysBefore: 2,
    });

    // All three entity types coexist
    const profiles = await memoryRepo.listProfiles();
    const starts = await memoryRepo.listCycleStarts(profile.id);
    const prefs = await memoryRepo.listNotificationPreferences();

    expect(profiles).toHaveLength(1);
    expect(starts).toHaveLength(1);
    expect(prefs).toHaveLength(1);
  });

  it("existing data intact after NotificationPreference table added", async () => {
    // Simulates v1 → v2: existing Profile + CycleStart data survives
    const p1 = await memoryRepo.createProfile("Alice");
    const p2 = await memoryRepo.createProfile("Bob");
    await memoryRepo.addCycleStart(p1.id, "2026-01-15");
    await memoryRepo.addCycleStart(p1.id, "2026-02-12");
    await memoryRepo.addCycleStart(p2.id, "2026-01-20");

    // "After migration": NotificationPreference table is available
    const pref = await memoryRepo.getNotificationPreference(p1.id);
    expect(pref).toBeNull(); // No preference yet — correct for migrated data

    // Existing data intact
    const profiles = await memoryRepo.listProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.name).sort()).toEqual(["Alice", "Bob"]);

    const starts = await memoryRepo.listCycleStarts(p1.id);
    expect(starts).toHaveLength(2);

    // Can now create preferences on migrated profiles
    await memoryRepo.setNotificationPreference(p1.id, true, 1);
    const read = await memoryRepo.getNotificationPreference(p1.id);
    expect(read).toEqual({ profileId: p1.id, enabled: true, daysBefore: 1 });
  });

  it("cascade delete removes NotificationPreference with profile", async () => {
    const profile = await memoryRepo.createProfile("CascadeTest");
    await memoryRepo.addCycleStart(profile.id, "2026-03-10");
    await memoryRepo.setNotificationPreference(profile.id, true, 2);

    await memoryRepo.deleteProfile(profile.id);

    expect(await memoryRepo.getNotificationPreference(profile.id)).toBeNull();
    expect(await memoryRepo.listCycleStarts(profile.id)).toHaveLength(0);
    expect(await memoryRepo.listProfiles()).toHaveLength(0);
  });
});

describe("schema migration — Realm-specific (manual verification)", () => {
  /**
   * These tests require a device or emulator with Realm native modules.
   * Run them as part of the manual testing checklist before release.
   *
   * Verification steps:
   *
   * 1. FRESH INSTALL:
   *    - Uninstall app completely
   *    - Install and launch
   *    - Verify: Realm opens at schemaVersion 2
   *    - Verify: Profile, CycleStart, NotificationPreference tables all exist
   *    - Verify: Can create profiles, log cycles, set notification preferences
   *
   * 2. v1 → v2 UPGRADE:
   *    - Start with v0.3 build (schemaVersion 1)
   *    - Create profiles and log cycle starts
   *    - Install v0.4 build over existing app
   *    - Verify: App opens without errors
   *    - Verify: Existing profiles and cycle starts are intact
   *    - Verify: NotificationPreference table is available
   *    - Verify: Can toggle notifications in Settings
   *
   * 3. MIGRATION FAILURE RECOVERY:
   *    - Corrupt Realm file (manual hex edit or schema mismatch)
   *    - Launch app
   *    - Verify: Console shows "[Realm] Migration failed, deleting and recreating:"
   *    - Verify: App recovers and opens with fresh schema v2
   *    - Verify: Data is lost (expected) but app is functional
   */

  it.todo(
    "fresh install — Realm opens at schemaVersion 2 with all three object types",
  );
  it.todo(
    "v1 → v2 upgrade — existing Profile and CycleStart data intact, NotificationPreference available",
  );
  it.todo(
    "migration failure — error logged, Realm deleted and recreated with fresh schema",
  );
});
