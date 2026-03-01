import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import type { SyncLogger } from "./reconcileNotifications";
import { loadActiveProfileId, saveActiveProfileId } from "./AppState";
import { syncNotifications } from "./syncNotifications";

/**
 * Cold-start reconciliation: ensures state coherence at app launch.
 *
 * Guarantees:
 *   - Active profile id always references an existing profile (or is null).
 *   - If profiles exist but no active is set, lowest id is selected.
 *   - Notification schedule matches current repo state.
 *   - Idempotent — safe to call multiple times.
 *   - Never mutates user data (cycleStarts are read-only).
 */
export async function reconcileOnLaunch(
  repo: Repository,
  adapter: NotificationAdapter,
  logger?: SyncLogger,
): Promise<void> {
  const profiles = await repo.listProfiles();
  const activeId = await loadActiveProfileId();

  if (profiles.length === 0) {
    // No profiles — clear active
    if (activeId !== null) {
      await saveActiveProfileId(null);
    }
  } else if (activeId !== null) {
    // Active is set — verify it still exists
    const exists = profiles.some((p) => p.id === activeId);
    if (!exists) {
      const sorted = [...profiles].sort((a, b) => a.id - b.id);
      await saveActiveProfileId(sorted[0].id);
    }
  } else {
    // Profiles exist but no active set — assign lowest id
    const sorted = [...profiles].sort((a, b) => a.id - b.id);
    await saveActiveProfileId(sorted[0].id);
  }

  try {
    await syncNotifications(repo, adapter, logger);
  } catch (error: unknown) {
    if (logger) {
      logger.onError("reconcileOnLaunch", "sync", error);
    }
  }
}
