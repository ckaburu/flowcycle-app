import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import type { SyncLogger } from "./reconcileNotifications";
import { ImportValidationError } from "./errors";
import { isValidIsoDate } from "../utils/date";
import { saveActiveProfileId } from "./AppState";
import { syncNotifications } from "./syncNotifications";

function isIsoTimestamp(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new ImportValidationError(message);
}

type ValidatedCycleStart = {
  startDateIso: string;
  createdAt: string;
};

type ValidatedNotifPref = {
  enabled: boolean;
  daysBefore: number;
};

type ValidatedProfile = {
  id: number;
  name: string;
  createdAt: string;
  cycleStarts: ValidatedCycleStart[];
  notificationPreference: ValidatedNotifPref | null;
};

type ValidatedBundle = {
  profiles: ValidatedProfile[];
};

function validateBundle(bundle: unknown): ValidatedBundle {
  if (!isRecord(bundle)) {
    fail("Bundle must be an object.");
  }

  if (bundle.schemaVersion !== 1) {
    fail("Unsupported schemaVersion. Expected 1.");
  }

  if (typeof bundle.appVersion !== "string") {
    fail("appVersion must be a string.");
  }

  if (typeof bundle.exportedAtIso !== "string" || !isIsoTimestamp(bundle.exportedAtIso)) {
    fail("exportedAtIso must be a valid ISO timestamp.");
  }

  if (!Array.isArray(bundle.profiles)) {
    fail("profiles must be an array.");
  }

  const seenIds = new Set<number>();
  const validatedProfiles: ValidatedProfile[] = [];

  for (let i = 0; i < bundle.profiles.length; i++) {
    const p = bundle.profiles[i] as unknown;
    if (!isRecord(p)) {
      fail(`profiles[${i}] must be an object.`);
    }

    if (typeof p.id !== "number" || !Number.isInteger(p.id) || p.id <= 0) {
      fail(`profiles[${i}].id must be a positive integer.`);
    }

    if (seenIds.has(p.id as number)) {
      fail(`Duplicate profile id: ${p.id}.`);
    }
    seenIds.add(p.id as number);

    if (typeof p.name !== "string" || (p.name as string).trim() === "") {
      fail(`profiles[${i}].name must be a non-empty string.`);
    }

    if (typeof p.createdAt !== "string" || !isIsoTimestamp(p.createdAt as string)) {
      fail(`profiles[${i}].createdAt must be a valid ISO timestamp.`);
    }

    if (!Array.isArray(p.cycleStarts)) {
      fail(`profiles[${i}].cycleStarts must be an array.`);
    }

    const validatedCycleStarts: ValidatedCycleStart[] = [];

    for (let j = 0; j < (p.cycleStarts as unknown[]).length; j++) {
      const cs = (p.cycleStarts as unknown[])[j];
      if (!isRecord(cs)) {
        fail(`profiles[${i}].cycleStarts[${j}] must be an object.`);
      }

      if (typeof cs.startDateIso !== "string" || !isValidIsoDate(cs.startDateIso as string)) {
        fail(`profiles[${i}].cycleStarts[${j}].startDateIso must be a valid YYYY-MM-DD date.`);
      }

      if (typeof cs.createdAt !== "string" || !isIsoTimestamp(cs.createdAt as string)) {
        fail(`profiles[${i}].cycleStarts[${j}].createdAt must be a valid ISO timestamp.`);
      }

      // Enforce ascending sort order
      if (j > 0) {
        const prev = validatedCycleStarts[j - 1].startDateIso;
        if ((cs.startDateIso as string) <= prev) {
          fail(`profiles[${i}].cycleStarts must be sorted by startDateIso ascending. Found "${cs.startDateIso}" after "${prev}".`);
        }
      }

      validatedCycleStarts.push({
        startDateIso: cs.startDateIso as string,
        createdAt: cs.createdAt as string,
      });
    }

    // Validate notificationPreference
    let validatedPref: ValidatedNotifPref | null = null;

    if (p.notificationPreference === null) {
      validatedPref = null;
    } else if (isRecord(p.notificationPreference)) {
      const np = p.notificationPreference;
      if (typeof np.enabled !== "boolean") {
        fail(`profiles[${i}].notificationPreference.enabled must be a boolean.`);
      }
      if (typeof np.daysBefore !== "number" || !Number.isInteger(np.daysBefore)) {
        fail(`profiles[${i}].notificationPreference.daysBefore must be an integer.`);
      }
      validatedPref = {
        enabled: np.enabled as boolean,
        daysBefore: np.daysBefore as number,
      };
    } else {
      fail(`profiles[${i}].notificationPreference must be null or an object.`);
    }

    validatedProfiles.push({
      id: p.id as number,
      name: p.name as string,
      createdAt: p.createdAt as string,
      cycleStarts: validatedCycleStarts,
      notificationPreference: validatedPref,
    });
  }

  return { profiles: validatedProfiles };
}

/**
 * Import a full data bundle into the repository.
 *
 * Semantics: strict overwrite.
 * - Validates the entire bundle BEFORE any destructive operation.
 * - If validation fails, nothing changes.
 * - On success: wipes all existing data and replaces with bundle contents.
 * - Sets active profile to lowest id if profiles exist, else clears.
 * - Re-syncs notifications for imported profiles.
 */
export async function importData(
  repo: Repository,
  adapter: NotificationAdapter,
  bundle: unknown,
  logger?: SyncLogger,
): Promise<void> {
  // Validate first — if this throws, repo is untouched
  const validated = validateBundle(bundle);

  // Flatten into repo-level arrays
  const profiles = validated.profiles.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
  }));

  const cycleStarts: Array<{ profileId: number; startDateIso: string; createdAt: string }> = [];
  for (const p of validated.profiles) {
    for (const cs of p.cycleStarts) {
      cycleStarts.push({
        profileId: p.id,
        startDateIso: cs.startDateIso,
        createdAt: cs.createdAt,
      });
    }
  }

  const notificationPreferences: Array<{ profileId: number; enabled: boolean; daysBefore: number }> = [];
  for (const p of validated.profiles) {
    if (p.notificationPreference) {
      notificationPreferences.push({
        profileId: p.id,
        enabled: p.notificationPreference.enabled,
        daysBefore: p.notificationPreference.daysBefore,
      });
    }
  }

  // Overwrite
  await repo.importRawData(profiles, cycleStarts, notificationPreferences);

  // Set active profile
  if (profiles.length > 0) {
    const sorted = [...profiles].sort((a, b) => a.id - b.id);
    await saveActiveProfileId(sorted[0].id);
  } else {
    await saveActiveProfileId(null);
  }

  // Re-sync notifications
  await syncNotifications(repo, adapter, logger);
}
