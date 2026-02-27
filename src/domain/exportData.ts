import type { Repository, CycleStart, NotificationPreference } from "../db/repo";

export type ExportedCycleStart = {
  startDateIso: string;
  createdAt: string;
};

export type ExportedProfile = {
  id: number;
  name: string;
  createdAt: string;
  cycleStarts: ExportedCycleStart[];
  notificationPreference: {
    enabled: boolean;
    daysBefore: number;
  } | null;
};

export type ExportBundleV1 = {
  schemaVersion: 1;
  appVersion: string;
  exportedAtIso: string;
  profiles: ExportedProfile[];
};

export async function exportData(
  repo: Repository,
  appVersion: string,
): Promise<ExportBundleV1> {
  const profiles = await repo.listProfiles();

  const sortedProfiles = [...profiles].sort((a, b) => a.id - b.id);

  const exportedProfiles: ExportedProfile[] = await Promise.all(
    sortedProfiles.map(async (profile) => {
      const cycleStarts = await repo.listCycleStarts(profile.id);
      const notifPref = await repo.getNotificationPreference(profile.id);

      const sortedCycleStarts: ExportedCycleStart[] = [...cycleStarts]
        .sort((a, b) => (a.startDateIso < b.startDateIso ? -1 : a.startDateIso > b.startDateIso ? 1 : 0))
        .map((cs: CycleStart) => ({
          startDateIso: cs.startDateIso,
          createdAt: cs.createdAt,
        }));

      const notificationPreference: ExportedProfile["notificationPreference"] =
        notifPref
          ? { enabled: notifPref.enabled, daysBefore: notifPref.daysBefore }
          : null;

      return {
        id: profile.id,
        name: profile.name,
        createdAt: profile.createdAt,
        cycleStarts: sortedCycleStarts,
        notificationPreference,
      };
    }),
  );

  return {
    schemaVersion: 1,
    appVersion,
    exportedAtIso: new Date().toISOString(),
    profiles: exportedProfiles,
  };
}
