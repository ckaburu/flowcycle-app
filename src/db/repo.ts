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

export interface Repo {
  init(): Promise<void>;
  createProfile(name: string): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  deleteProfile(id: number): Promise<void>;
  addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart>;
  listCycleStarts(profileId: number): Promise<CycleStart[]>;
  clearAllForTesting(): Promise<void>;
}
