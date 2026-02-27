export type Profile = {
  id: number;
  name: string;
  createdAt: string;
};

export type CycleStart = {
  id: number;
  profileId: number;
  startDateIso: string;
  createdAt: string;
};

export type NotificationPreference = {
  profileId: number;
  enabled: boolean;
  daysBefore: number;
};

export interface Repository {
  init(): Promise<void>;
  createProfile(name: string): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  renameProfile(id: number, newName: string): Promise<void>;
  deleteProfile(id: number): Promise<void>;
  addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart>;
  updateCycleStart(id: number, newStartDateIso: string): Promise<CycleStart>;
  deleteCycleStart(id: number): Promise<void>;
  listCycleStarts(profileId: number): Promise<CycleStart[]>;
  getNotificationPreference(profileId: number): Promise<NotificationPreference | null>;
  setNotificationPreference(profileId: number, enabled: boolean, daysBefore: number): Promise<NotificationPreference>;
  deleteNotificationPreference(profileId: number): Promise<void>;
  listNotificationPreferences(): Promise<NotificationPreference[]>;
  importRawData(
    profiles: Array<{ id: number; name: string; createdAt: string }>,
    cycleStarts: Array<{ profileId: number; startDateIso: string; createdAt: string }>,
    notificationPreferences: Array<{ profileId: number; enabled: boolean; daysBefore: number }>,
  ): Promise<void>;
  clearAllForTesting(): Promise<void>;
}
