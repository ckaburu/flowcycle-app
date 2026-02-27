import type { Repository } from "../db/repo";
import type { NotificationAdapter } from "../utils/notificationAdapter";
import type { SyncLogger } from "./reconcileNotifications";
import { loadActiveProfileId, saveActiveProfileId } from "./AppState";
import { syncNotifications } from "./syncNotifications";

/**
 * Delete a profile with full cascade, reassign active profile if needed,
 * and re-sync notifications for remaining profiles.
 *
 * Cascade (handled by repo.deleteProfile):
 *   - Profile record
 *   - All cycle starts for that profile
 *   - Notification preference for that profile
 *
 * Active profile reassignment:
 *   - If deleted profile was active and others remain → switch to lowest id
 *   - If deleted profile was active and none remain → clear active
 *   - If deleted profile was not active → no change
 */
export async function deleteProfileAndReassignActive(
  repo: Repository,
  adapter: NotificationAdapter,
  profileId: number,
  logger?: SyncLogger,
): Promise<void> {
  await repo.deleteProfile(profileId);

  const activeId = await loadActiveProfileId();

  if (activeId === profileId) {
    const remaining = await repo.listProfiles();
    if (remaining.length > 0) {
      const sorted = [...remaining].sort((a, b) => a.id - b.id);
      await saveActiveProfileId(sorted[0].id);
    } else {
      await saveActiveProfileId(null);
    }
  }

  await syncNotifications(repo, adapter, logger);
}
