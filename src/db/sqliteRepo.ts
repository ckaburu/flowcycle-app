import { SQLiteDatabase, openDatabaseAsync } from "expo-sqlite";

import { assertIsoDate } from "../utils/date";
import { CycleStart, Profile, Repo } from "./repo";

type ProfileRow = {
  id: number;
  name: string;
  created_at: string;
};

type CycleStartRow = {
  id: number;
  profile_id: number;
  start_date: string;
  created_at: string;
};

function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

class SQLiteRepo implements Repo {
  private dbPromise: Promise<SQLiteDatabase> | null = null;
  private initPromise: Promise<void> | null = null;

  private async getDb(): Promise<SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabaseAsync("flowcycle.db");
    }

    return this.dbPromise;
  }

  private async doInit(): Promise<void> {
    const db = await this.getDb();

    try {
      await db.execAsync("PRAGMA foreign_keys = ON;");
    } catch {
      // Best-effort pragma enablement for runtime environments that may reject this call.
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cycle_starts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `);
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }

    await this.initPromise;
  }

  async createProfile(name: string): Promise<Profile> {
    await this.init();
    const db = await this.getDb();

    const createdAt = nowIsoTimestamp();
    const result = await db.runAsync(
      "INSERT INTO profiles (name, created_at) VALUES (?, ?);",
      name,
      createdAt
    );

    return {
      id: Number(result.lastInsertRowId),
      name,
      createdAt,
    };
  }

  async listProfiles(): Promise<Profile[]> {
    await this.init();
    const db = await this.getDb();

    const rows = await db.getAllAsync<ProfileRow>(
      "SELECT id, name, created_at FROM profiles ORDER BY id ASC;"
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    }));
  }

  async deleteProfile(id: number): Promise<void> {
    await this.init();
    const db = await this.getDb();
    await db.runAsync("DELETE FROM profiles WHERE id = ?;", id);
  }

  async addCycleStart(profileId: number, startDateIso: string): Promise<CycleStart> {
    await this.init();
    assertIsoDate(startDateIso);

    const db = await this.getDb();
    const profile = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM profiles WHERE id = ?;",
      profileId
    );

    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const createdAt = nowIsoTimestamp();
    const result = await db.runAsync(
      "INSERT INTO cycle_starts (profile_id, start_date, created_at) VALUES (?, ?, ?);",
      profileId,
      startDateIso,
      createdAt
    );

    return {
      id: Number(result.lastInsertRowId),
      profileId,
      startDateIso,
      createdAt,
    };
  }

  async listCycleStarts(profileId: number): Promise<CycleStart[]> {
    await this.init();
    const db = await this.getDb();

    const rows = await db.getAllAsync<CycleStartRow>(
      "SELECT id, profile_id, start_date, created_at FROM cycle_starts WHERE profile_id = ? ORDER BY id ASC;",
      profileId
    );

    return rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      startDateIso: row.start_date,
      createdAt: row.created_at,
    }));
  }

  async clearAllForTesting(): Promise<void> {
    await this.init();
    const db = await this.getDb();
    await db.runAsync("DELETE FROM cycle_starts;");
    await db.runAsync("DELETE FROM profiles;");
  }
}

export const sqliteRepo: Repo = new SQLiteRepo();
