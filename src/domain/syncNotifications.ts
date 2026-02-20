import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import type { SyncLogger } from "./reconcileNotifications";
import type { ProfileNotificationInput } from "./notificationPlan";
import { computeNotificationPlan } from "./notificationPlan";
import { reconcileScheduledNotifications } from "./reconcileNotifications";

/** MVP: schedule one reminder per profile */
const MAX_REMINDERS_PER_PROFILE = 1;

const TRACKED_IDS_KEY = "flowcycle.trackedNotificationIds";

// ────────────────────────────────────────────
// AsyncStorage helpers
// ────────────────────────────────────────────

async function getTrackedNotificationIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(TRACKED_IDS_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function setTrackedNotificationIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(TRACKED_IDS_KEY, JSON.stringify(ids));
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────

/** Guard against concurrent sync runs (redundant adapter calls). */
let syncInFlight = false;

/**
 * Full notification sync: read data → compute plan → reconcile with adapter.
 *
 * This is the single entry point called from UI/bootstrap.
 * Idempotent — safe to call multiple times. Concurrent calls are
 * dropped (the next user action or foreground event will re-trigger).
 *
 * @param repo     Repository for profile/cycle/preference data
 * @param adapter  Platform notification adapter
 * @param logger   Optional DEV-only scheduling debug logger
 */
export async function syncNotifications(
  repo: Repository,
  adapter: NotificationAdapter,
  logger?: SyncLogger,
): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;

  try {
    // Local calendar date — not UTC. Ensures "today" matches the user's
    // wall-clock date so past-date filtering aligns with the reconciliation
    // layer's local-time interpretation of fire dates.
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayIso = `${yyyy}-${mm}-${dd}`;

    // 1. Gather data
    const prefs = await repo.listNotificationPreferences();
    const profiles = await repo.listProfiles();

    const inputs = await Promise.all(
      prefs.map(async (pref) => {
        const profile = profiles.find((p) => p.id === pref.profileId);
        if (!profile) return null;
        const cycles = await repo.listCycleStarts(pref.profileId);
        return {
          profileId: pref.profileId,
          profileName: profile.name,
          enabled: pref.enabled,
          daysBefore: pref.daysBefore,
          cycleStartDatesAsc: cycles.map((c) => c.startDateIso).sort(),
        } satisfies ProfileNotificationInput;
      }),
    );

    const validInputs = inputs.filter(
      (x): x is ProfileNotificationInput => x !== null,
    );

    // 2. Compute plan (pure domain)
    const existingIds = await getTrackedNotificationIds();
    const plan = computeNotificationPlan(
      validInputs,
      existingIds,
      todayIso,
      MAX_REMINDERS_PER_PROFILE,
    );

    // 3. Reconcile (infra via adapter)
    await reconcileScheduledNotifications(plan, adapter, logger);

    // 4. Persist new state of tracked IDs
    const newIds = [
      ...existingIds.filter((id) => !plan.toCancel.includes(id)),
      ...plan.toSchedule.map((item) => item.id),
    ];
    await setTrackedNotificationIds(newIds);
  } finally {
    syncInFlight = false;
  }
}
