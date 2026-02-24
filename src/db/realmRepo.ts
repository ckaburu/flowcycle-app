import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import Realm from "realm";

import { assertNotFutureDate, DuplicateCycleStartError } from "../domain/errors";
import { assertIsoDate } from "../utils/date";
import { CycleStart, NotificationPreference, Profile, Repository } from "./repo";

const REALM_PATH = "flowcycle.realm";
const REALM_KEY_STORE_NAME = "realm_encryption_key_v1";

const PROFILE_SCHEMA_NAME = "Profile";
const CYCLE_START_SCHEMA_NAME = "CycleStart";
const NOTIFICATION_PREFERENCE_SCHEMA_NAME = "NotificationPreference";

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

const NotificationPreferenceSchema: Realm.ObjectSchema = {
  name: NOTIFICATION_PREFERENCE_SCHEMA_NAME,
  primaryKey: "profileId",
  properties: {
    profileId: "int",
    enabled: "bool",
    daysBefore: "int",
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
  return Crypto.getRandomBytes(64);
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

type NotificationPreferenceRecord = Realm.Object & {
  profileId: number;
  enabled: boolean;
  daysBefore: number;
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

    const realmConfig: Realm.Configuration = {
      path: REALM_PATH,
      schema: [ProfileSchema, CycleStartSchema, NotificationPreferenceSchema],
      schemaVersion: 2,
      encryptionKey,
      onMigration: (oldRealm: Realm, _newRealm: Realm) => {
        if (oldRealm.schemaVersion < 2) {
          // Additive migration: new object type only.
          // Realm auto-creates the NotificationPreference table.
          // No data transformation required.
        }
      },
    };

    try {
      this.realm = await Realm.open(realmConfig);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isMigrationError =
        message.includes("migration") || message.includes("schema version");
      if (isMigrationError) {
        console.error("[Realm] Migration failed, deleting and recreating:", error);
        Realm.deleteFile(realmConfig);
        this.realm = await Realm.open(realmConfig);
      } else {
        throw error;
      }
    }
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
      const pref = realm.objectForPrimaryKey<NotificationPreferenceRecord>(
        NOTIFICATION_PREFERENCE_SCHEMA_NAME,
        id,
      );

      realm.delete(cycleStarts);
      if (pref) {
        realm.delete(pref);
      }
      if (profile) {
        realm.delete(profile);
      }
    });
  }

  async addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart> {
    await this.init();
    assertIsoDate(startDateIso);
    assertNotFutureDate(startDateIso);

    const realm = this.getRealmOrThrow();
    const profile = realm.objectForPrimaryKey<ProfileRecord>(PROFILE_SCHEMA_NAME, profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const existing = realm
      .objects<CycleStartRecord>(CYCLE_START_SCHEMA_NAME)
      .filtered("profileId == $0 AND startDateIso == $1", profileId, startDateIso);
    if (existing.length > 0) {
      throw new DuplicateCycleStartError(startDateIso);
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

  async updateCycleStart(id: number, newStartDateIso: string): Promise<CycleStart> {
    await this.init();
    assertIsoDate(newStartDateIso);
    assertNotFutureDate(newStartDateIso);

    const realm = this.getRealmOrThrow();
    const entry = realm.objectForPrimaryKey<CycleStartRecord>(CYCLE_START_SCHEMA_NAME, id);
    if (!entry) {
      throw new Error(`CycleStart not found: ${id}`);
    }

    const duplicate = realm
      .objects<CycleStartRecord>(CYCLE_START_SCHEMA_NAME)
      .filtered("profileId == $0 AND startDateIso == $1 AND id != $2", entry.profileId, newStartDateIso, id);
    if (duplicate.length > 0) {
      throw new DuplicateCycleStartError(newStartDateIso);
    }

    realm.write(() => {
      entry.startDateIso = newStartDateIso;
    });

    return {
      id: entry.id,
      profileId: entry.profileId,
      startDateIso: entry.startDateIso,
      createdAt: entry.createdAt,
    };
  }

  async deleteCycleStart(id: number): Promise<void> {
    await this.init();
    const realm = this.getRealmOrThrow();

    realm.write(() => {
      const entry = realm.objectForPrimaryKey<CycleStartRecord>(CYCLE_START_SCHEMA_NAME, id);
      if (entry) {
        realm.delete(entry);
      }
    });
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

  async getNotificationPreference(profileId: number): Promise<NotificationPreference | null> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const record = realm.objectForPrimaryKey<NotificationPreferenceRecord>(
      NOTIFICATION_PREFERENCE_SCHEMA_NAME,
      profileId,
    );
    if (!record) {
      return null;
    }
    return { profileId: record.profileId, enabled: record.enabled, daysBefore: record.daysBefore };
  }

  async setNotificationPreference(
    profileId: number,
    enabled: boolean,
    daysBefore: number,
  ): Promise<NotificationPreference> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const pref: NotificationPreference = { profileId, enabled, daysBefore };
    realm.write(() => {
      realm.create(
        NOTIFICATION_PREFERENCE_SCHEMA_NAME,
        pref,
        Realm.UpdateMode.Modified,
      );
    });
    return { ...pref };
  }

  async deleteNotificationPreference(profileId: number): Promise<void> {
    await this.init();
    const realm = this.getRealmOrThrow();

    realm.write(() => {
      const record = realm.objectForPrimaryKey<NotificationPreferenceRecord>(
        NOTIFICATION_PREFERENCE_SCHEMA_NAME,
        profileId,
      );
      if (record) {
        realm.delete(record);
      }
    });
  }

  async listNotificationPreferences(): Promise<NotificationPreference[]> {
    await this.init();
    const realm = this.getRealmOrThrow();

    const entries = realm
      .objects<NotificationPreferenceRecord>(NOTIFICATION_PREFERENCE_SCHEMA_NAME)
      .map((entry) => ({
        profileId: entry.profileId,
        enabled: entry.enabled,
        daysBefore: entry.daysBefore,
      }));

    return Array.from(entries);
  }

  async clearAllForTesting(): Promise<void> {
    await this.init();
    const realm = this.getRealmOrThrow();

    realm.write(() => {
      realm.delete(realm.objects(NOTIFICATION_PREFERENCE_SCHEMA_NAME));
      realm.delete(realm.objects(CYCLE_START_SCHEMA_NAME));
      realm.delete(realm.objects(PROFILE_SCHEMA_NAME));
    });
  }
}

export const realmRepo: Repository = new RealmRepo();
