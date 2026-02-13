import { assertIsoDate } from "../utils/date";
import { CycleStart, Profile, Repo } from "./repo";

function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

class MemoryRepo implements Repo {
  private profiles: Profile[] = [];
  private cycleStarts: CycleStart[] = [];
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

  async deleteProfile(id: number): Promise<void> {
    this.profiles = this.profiles.filter((profile) => profile.id !== id);
    this.cycleStarts = this.cycleStarts.filter((entry) => entry.profileId !== id);
  }

  async addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart> {
    assertIsoDate(startDateIso);

    const profileExists = this.profiles.some((profile) => profile.id === profileId);
    if (!profileExists) {
      throw new Error(`Profile not found: ${profileId}`);
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

  async listCycleStarts(profileId: number): Promise<CycleStart[]> {
    return this.cycleStarts
      .filter((entry) => entry.profileId === profileId)
      .map((entry) => ({ ...entry }));
  }

  async clearAllForTesting(): Promise<void> {
    this.profiles = [];
    this.cycleStarts = [];
    this.nextProfileId = 1;
    this.nextCycleStartId = 1;
  }
}

export const memoryRepo: Repo = new MemoryRepo();
