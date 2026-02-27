import { assertNotFutureDate, DuplicateCycleStartError } from "../domain/errors";
import { assertIsoDate } from "../utils/date";
import { CycleStart, NotificationPreference, Profile, Repository } from "./repo";

function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

class MemoryRepo implements Repository {
  private profiles: Profile[] = [];
  private cycleStarts: CycleStart[] = [];
  private notificationPreferences: NotificationPreference[] = [];
  private nextProfileId = 1;
  private nextCycleStartId = 1;

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async createProfile(name: string): Promise<Profile> {
    const profile: Profile = {
      id: this.nextProfileId++,
      name,
      createdAt: nowIsoTimestamp(),
    };

    this.profiles.push(profile);
    return profile;
  }

  async listProfiles(): Promise<Profile[]> {
    return this.profiles.map((profile) => ({ ...profile }));
  }

  async renameProfile(id: number, newName: string): Promise<void> {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }
    profile.name = newName;
  }

  async deleteProfile(id: number): Promise<void> {
    this.profiles = this.profiles.filter((profile) => profile.id !== id);
    this.cycleStarts = this.cycleStarts.filter((entry) => entry.profileId !== id);
    this.notificationPreferences = this.notificationPreferences.filter(
      (pref) => pref.profileId !== id,
    );
  }

  async addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart> {
    assertIsoDate(startDateIso);
    assertNotFutureDate(startDateIso);

    const profileExists = this.profiles.some((profile) => profile.id === profileId);
    if (!profileExists) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const duplicate = this.cycleStarts.some(
      (entry) => entry.profileId === profileId && entry.startDateIso === startDateIso,
    );
    if (duplicate) {
      throw new DuplicateCycleStartError(startDateIso);
    }

    const cycleStart: CycleStart = {
      id: this.nextCycleStartId++,
      profileId,
      startDateIso,
      createdAt: nowIsoTimestamp(),
    };

    this.cycleStarts.push(cycleStart);
    return cycleStart;
  }

  async updateCycleStart(id: number, newStartDateIso: string): Promise<CycleStart> {
    assertIsoDate(newStartDateIso);
    assertNotFutureDate(newStartDateIso);

    const entry = this.cycleStarts.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`CycleStart not found: ${id}`);
    }

    const duplicate = this.cycleStarts.some(
      (e) => e.id !== id && e.profileId === entry.profileId && e.startDateIso === newStartDateIso,
    );
    if (duplicate) {
      throw new DuplicateCycleStartError(newStartDateIso);
    }

    entry.startDateIso = newStartDateIso;
    return { ...entry };
  }

  async deleteCycleStart(id: number): Promise<void> {
    this.cycleStarts = this.cycleStarts.filter((entry) => entry.id !== id);
  }

  async listCycleStarts(profileId: number): Promise<CycleStart[]> {
    return this.cycleStarts
      .filter((entry) => entry.profileId === profileId)
      .map((entry) => ({ ...entry }));
  }

  async getNotificationPreference(profileId: number): Promise<NotificationPreference | null> {
    const pref = this.notificationPreferences.find((p) => p.profileId === profileId);
    return pref ? { ...pref } : null;
  }

  async setNotificationPreference(
    profileId: number,
    enabled: boolean,
    daysBefore: number,
  ): Promise<NotificationPreference> {
    const existing = this.notificationPreferences.findIndex((p) => p.profileId === profileId);
    const pref: NotificationPreference = { profileId, enabled, daysBefore };
    if (existing >= 0) {
      this.notificationPreferences[existing] = pref;
    } else {
      this.notificationPreferences.push(pref);
    }
    return { ...pref };
  }

  async deleteNotificationPreference(profileId: number): Promise<void> {
    this.notificationPreferences = this.notificationPreferences.filter(
      (p) => p.profileId !== profileId,
    );
  }

  async listNotificationPreferences(): Promise<NotificationPreference[]> {
    return this.notificationPreferences.map((p) => ({ ...p }));
  }

  async importRawData(
    profiles: Array<{ id: number; name: string; createdAt: string }>,
    cycleStarts: Array<{ profileId: number; startDateIso: string; createdAt: string }>,
    notificationPreferences: Array<{ profileId: number; enabled: boolean; daysBefore: number }>,
  ): Promise<void> {
    this.profiles = profiles.map((p) => ({ ...p }));
    this.nextProfileId =
      profiles.length > 0 ? Math.max(...profiles.map((p) => p.id)) + 1 : 1;

    let nextCsId = 1;
    this.cycleStarts = cycleStarts.map((cs) => ({
      id: nextCsId++,
      profileId: cs.profileId,
      startDateIso: cs.startDateIso,
      createdAt: cs.createdAt,
    }));
    this.nextCycleStartId = nextCsId;

    this.notificationPreferences = notificationPreferences.map((np) => ({ ...np }));
  }

  async clearAllForTesting(): Promise<void> {
    this.profiles = [];
    this.cycleStarts = [];
    this.notificationPreferences = [];
    this.nextProfileId = 1;
    this.nextCycleStartId = 1;
  }
}

export const memoryRepo: Repository = new MemoryRepo();
