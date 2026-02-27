import { memoryRepo } from "../db/memoryRepo";
import type { Repository } from "../db/repo";
import { exportData, ExportBundleV1, ExportedProfile } from "./exportData";

const repo: Repository = memoryRepo;

function findProfile(
  profiles: ExportedProfile[],
  name: string,
): ExportedProfile {
  const match = profiles.find((p) => p.name === name);
  if (!match) throw new Error(`Profile "${name}" not found in export`);
  return match;
}

beforeEach(async () => {
  await repo.clearAllForTesting();
});

describe("exportData", () => {
  describe("basic structure", () => {
    let result: ExportBundleV1;

    beforeEach(async () => {
      // Create Bob first, Alice second — reverse alphabetical insertion
      // to verify sorting is by id ASC, not name or insertion order reversal
      const bob = await repo.createProfile("Bob");
      const alice = await repo.createProfile("Alice");

      // Cycle starts out of date order for Alice
      await repo.addCycleStart(alice.id, "2026-01-15");
      await repo.addCycleStart(alice.id, "2026-01-01");
      await repo.addCycleStart(alice.id, "2026-02-10");

      // Cycle starts out of date order for Bob
      await repo.addCycleStart(bob.id, "2025-12-20");
      await repo.addCycleStart(bob.id, "2026-01-18");

      // Notification preference for Alice only
      await repo.setNotificationPreference(alice.id, true, 2);

      result = await exportData(repo, "0.4.4");
    });

    it("sets schemaVersion to 1", () => {
      expect(result.schemaVersion).toBe(1);
    });

    it("sets appVersion from argument", () => {
      expect(result.appVersion).toBe("0.4.4");
    });

    it("sets exportedAtIso to a valid ISO string", () => {
      expect(new Date(result.exportedAtIso).toISOString()).toBe(
        result.exportedAtIso,
      );
    });

    it("sorts profiles by id ascending regardless of creation order", () => {
      expect(result.profiles.length).toBe(2);
      // Bob was created first (lower id), Alice second (higher id)
      expect(result.profiles[0].name).toBe("Bob");
      expect(result.profiles[1].name).toBe("Alice");
      expect(result.profiles[0].id).toBeLessThan(result.profiles[1].id);
    });

    it("sorts cycleStarts by startDateIso ascending", () => {
      const alice = findProfile(result.profiles, "Alice");
      const aliceDates = alice.cycleStarts.map((cs) => cs.startDateIso);
      expect(aliceDates).toEqual(["2026-01-01", "2026-01-15", "2026-02-10"]);

      const bob = findProfile(result.profiles, "Bob");
      const bobDates = bob.cycleStarts.map((cs) => cs.startDateIso);
      expect(bobDates).toEqual(["2025-12-20", "2026-01-18"]);
    });

    it("includes notificationPreference when set", () => {
      const alice = findProfile(result.profiles, "Alice");
      expect(alice.notificationPreference).toEqual({
        enabled: true,
        daysBefore: 2,
      });
    });

    it("returns null notificationPreference when not set", () => {
      const bob = findProfile(result.profiles, "Bob");
      expect(bob.notificationPreference).toBeNull();
    });

    it("includes only raw fields on cycleStarts (startDateIso + createdAt)", () => {
      for (const profile of result.profiles) {
        for (const cs of profile.cycleStarts) {
          const keys = Object.keys(cs).sort();
          expect(keys).toEqual(["createdAt", "startDateIso"]);
        }
      }
    });

    it("includes only raw fields on profiles (no derived fields)", () => {
      for (const profile of result.profiles) {
        const keys = Object.keys(profile).sort();
        expect(keys).toEqual([
          "createdAt",
          "cycleStarts",
          "id",
          "name",
          "notificationPreference",
        ]);
      }
    });

    it("has no derived fields on top-level bundle", () => {
      const keys = Object.keys(result).sort();
      expect(keys).toEqual([
        "appVersion",
        "exportedAtIso",
        "profiles",
        "schemaVersion",
      ]);
    });
  });

  describe("sorting robustness", () => {
    it("sorts profiles by id ASC even when later profile has lower name", async () => {
      // Create Zara first (id=1), then Ada (id=2)
      const zara = await repo.createProfile("Zara");
      const ada = await repo.createProfile("Ada");

      const result = await exportData(repo, "0.4.4");

      expect(result.profiles[0].name).toBe("Zara");
      expect(result.profiles[1].name).toBe("Ada");
      expect(result.profiles[0].id).toBe(zara.id);
      expect(result.profiles[1].id).toBe(ada.id);
    });

    it("sorts cycleStarts ASC when inserted in descending order", async () => {
      const profile = await repo.createProfile("Descending");

      // Insert strictly descending
      await repo.addCycleStart(profile.id, "2026-02-20");
      await repo.addCycleStart(profile.id, "2026-02-10");
      await repo.addCycleStart(profile.id, "2026-01-25");
      await repo.addCycleStart(profile.id, "2026-01-05");

      const result = await exportData(repo, "0.4.4");
      const exported = findProfile(result.profiles, "Descending");
      const dates = exported.cycleStarts.map((cs) => cs.startDateIso);

      expect(dates).toEqual([
        "2026-01-05",
        "2026-01-25",
        "2026-02-10",
        "2026-02-20",
      ]);
    });

    it("handles single profile with single cycle start", async () => {
      const profile = await repo.createProfile("Solo");
      await repo.addCycleStart(profile.id, "2026-02-01");

      const result = await exportData(repo, "0.4.4");

      expect(result.profiles.length).toBe(1);
      const solo = findProfile(result.profiles, "Solo");
      expect(solo.cycleStarts.length).toBe(1);
      expect(solo.cycleStarts[0].startDateIso).toBe("2026-02-01");
    });

    it("handles profile with no cycle starts", async () => {
      await repo.createProfile("Empty");

      const result = await exportData(repo, "0.4.4");
      const empty = findProfile(result.profiles, "Empty");

      expect(empty.cycleStarts).toEqual([]);
      expect(empty.notificationPreference).toBeNull();
    });
  });

  describe("determinism", () => {
    it("produces identical output when clock is frozen", async () => {
      const profile = await repo.createProfile("Test");
      await repo.addCycleStart(profile.id, "2026-01-10");
      await repo.setNotificationPreference(profile.id, false, 1);

      const frozen = new Date("2026-02-25T12:00:00.000Z");
      jest.useFakeTimers({ now: frozen });

      try {
        const result1 = await exportData(repo, "0.4.4");
        const result2 = await exportData(repo, "0.4.4");
        expect(result1).toEqual(result2);
        expect(result1.exportedAtIso).toBe("2026-02-25T12:00:00.000Z");
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("JSON serializability", () => {
    it("survives JSON round-trip without data loss", async () => {
      const profile = await repo.createProfile("Roundtrip");
      await repo.addCycleStart(profile.id, "2026-01-05");
      await repo.setNotificationPreference(profile.id, true, 0);

      const result = await exportData(repo, "0.4.4");
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json) as ExportBundleV1;

      expect(parsed).toEqual(result);
    });
  });

  describe("schema literal", () => {
    it("schemaVersion is the literal number 1", async () => {
      const result = await exportData(repo, "0.4.4");
      expect(result.schemaVersion).toBe(1);
      expect(typeof result.schemaVersion).toBe("number");
    });
  });
});
