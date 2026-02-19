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
  deleteProfile(id: number): Promise<void>;
  addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart>;
  listCycleStarts(profileId: number): Promise<CycleStart[]>;
  getNotificationPreference(profileId: number): Promise<NotificationPreference | null>;
  setNotificationPreference(profileId: number, enabled: boolean, daysBefore: number): Promise<NotificationPreference>;
  deleteNotificationPreference(profileId: number): Promise<void>;
  listNotificationPreferences(): Promise<NotificationPreference[]>;
  clearAllForTesting(): Promise<void>;
}
