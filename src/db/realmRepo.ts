import * as SecureStore from "expo-secure-store";
import Realm from "realm";

import { assertIsoDate } from "../utils/date";
import { CycleStart, Profile, Repository } from "./repo";

const REALM_PATH = "flowcycle.realm";
const REALM_KEY_STORE_NAME = "realm_encryption_key_v1";

const PROFILE_SCHEMA_NAME = "Profile";
const CYCLE_START_SCHEMA_NAME = "CycleStart";

const ProfileSchema: Realm.ObjectSchema = {
  name: PROFILE_SCHEMA_NAME,
  primaryKey: "id",
  properties: {
    id: "int",
    name: "string",
    createdAt: "string",
  },
};

const CycleStartSchema: Realm.ObjectSchema = {
  name: CYCLE_START_SCHEMA_NAME,
  primaryKey: "id",
  properties: {
    id: "int",
    profileId: { type: "int", indexed: true },
    startDateIso: "string",
    createdAt: "string",
  },
};

function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 128) {
    throw new Error("Stored Realm encryption key has invalid length.");
  }

  const key = new Uint8Array(64);
  for (let index = 0; index < key.length; index += 1) {
    const start = index * 2;
    const pair = hex.slice(start, start + 2);
    const parsed = Number.parseInt(pair, 16);
    if (!Number.isFinite(parsed)) {
      throw new Error("Stored Realm encryption key has invalid format.");
    }
    key[index] = parsed;
  }
  return key;
}

function generateEncryptionKey(): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random generator is unavailable for Realm key creation.");
  }

  const key = new Uint8Array(64);
  cryptoApi.getRandomValues(key);
  return key;
}

type ProfileRecord = Realm.Object & {
  id: number;
  name: string;
  createdAt: string;
};

type CycleStartRecord = Realm.Object & {
  id: number;
  profileId: number;
  startDateIso: string;
  createdAt: string;
};

class RealmRepo implements Repository {
  private realm: Realm | null = null;
  private initPromise: Promise<void> | null = null;

  private getRealmOrThrow(): Realm {
    if (!this.realm) {
      throw new Error("Realm repository has not been initialized.");
    }
    return this.realm;
  }

  private getNextId(realm: Realm, schemaName: string): number {
    const latest = realm.objects(schemaName).sorted("id", true)[0];
    if (!latest) {
      return 1;
    }

    return ((latest as unknown as { id: number }).id ?? 0) + 1;
  }

  private async getOrCreateEncryptionKey(): Promise<Uint8Array> {
    const storedKey = await SecureStore.getItemAsync(REALM_KEY_STORE_NAME);
    if (storedKey) {
      return hexToBytes(storedKey);
    }

    if (Realm.exists(REALM_PATH)) {
      throw new Error(
        `Missing encryption key "${REALM_KEY_STORE_NAME}" for existing Realm at "${REALM_PATH}".`
      );
    }

    const key = generateEncryptionKey();
    await SecureStore.setItemAsync(REALM_KEY_STORE_NAME, bytesToHex(key));
    return key;
  }

  private async openRealm(): Promise<void> {
    const encryptionKey = await this.getOrCreateEncryptionKey();

    this.realm = await Realm.open({
      path: REALM_PATH,
      schema: [ProfileSchema, CycleStartSchema],
      schemaVersion: 1,
      encryptionKey,
    });
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.openRealm().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    await this.initPromise;
  }

  async createProfile(name: string): Promise<Profile> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const profile: Profile = {
      id: this.getNextId(realm, PROFILE_SCHEMA_NAME),
      name,
      createdAt: nowIsoTimestamp(),
    };

    realm.write(() => {
      realm.create(PROFILE_SCHEMA_NAME, profile);
    });

    return profile;
  }

  async listProfiles(): Promise<Profile[]> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const profiles = realm
      .objects<ProfileRecord>(PROFILE_SCHEMA_NAME)
      .sorted("id")
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        createdAt: entry.createdAt,
      }));

    return Array.from(profiles);
  }

  async deleteProfile(id: number): Promise<void> {
    await this.init();
    const realm = this.getRealmOrThrow();

    realm.write(() => {
      const profile = realm.objectForPrimaryKey<ProfileRecord>(PROFILE_SCHEMA_NAME, id);
      const cycleStarts = realm
        .objects<CycleStartRecord>(CYCLE_START_SCHEMA_NAME)
        .filtered("profileId == $0", id);

      realm.delete(cycleStarts);
      if (profile) {
        realm.delete(profile);
      }
    });
  }

  async addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart> {
    await this.init();
    assertIsoDate(startDateIso);

    const realm = this.getRealmOrThrow();
    const profile = realm.objectForPrimaryKey<ProfileRecord>(PROFILE_SCHEMA_NAME, profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const cycleStart: CycleStart = {
      id: this.getNextId(realm, CYCLE_START_SCHEMA_NAME),
      profileId,
      startDateIso,
      createdAt: nowIsoTimestamp(),
    };

    realm.write(() => {
      realm.create(CYCLE_START_SCHEMA_NAME, cycleStart);
    });

    return cycleStart;
  }

  async listCycleStarts(profileId: number): Promise<CycleStart[]> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const entries = realm
      .objects<CycleStartRecord>(CYCLE_START_SCHEMA_NAME)
      .filtered("profileId == $0", profileId)
      .sorted("id")
      .map((entry) => ({
        id: entry.id,
        profileId: entry.profileId,
        startDateIso: entry.startDateIso,
        createdAt: entry.createdAt,
      }));

    return Array.from(entries);
  }

  async clearAllForTesting(): Promise<void> {
    await this.init();
    const realm = this.getRealmOrThrow();

    realm.write(() => {
      realm.delete(realm.objects(CYCLE_START_SCHEMA_NAME));
      realm.delete(realm.objects(PROFILE_SCHEMA_NAME));
    });
  }
}

export const realmRepo: Repository = new RealmRepo();
