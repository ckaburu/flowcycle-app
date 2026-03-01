/**
 * DEV-ONLY stress baseline script.
 *
 * Seeds a large deterministic dataset into memoryRepo, then measures
 * timings for reconcileOnLaunch, exportData, importData, and syncNotifications.
 *
 * Run: npm run stress:baseline
 */

import { performance } from "node:perf_hooks";

// ────────────────────────────────────────────
// Shim window.localStorage for AsyncStorage in Node
// Must run BEFORE any domain imports.
// ────────────────────────────────────────────

const storage: Record<string, string> = {};

(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
    removeItem: (key: string) => { delete storage[key]; },
    clear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
    get length() { return Object.keys(storage).length; },
    key: (i: number) => Object.keys(storage)[i] ?? null,
  },
};

// ────────────────────────────────────────────
// Timing helper
// ────────────────────────────────────────────

async function measure<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

// ────────────────────────────────────────────
// Deterministic seed helpers
// ────────────────────────────────────────────

const PROFILES_COUNT = 5;
const CYCLES_PER_PROFILE = 120;
const ANCHOR_DATE = new Date(Date.UTC(2026, 1, 25)); // 2026-02-25
const CYCLE_INTERVAL_DAYS = 28;
const APP_VERSION = "0.5.0-stress";

function formatIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateCycleDates(count: number, anchor: Date, intervalDays: number): string[] {
  const MS_PER_DAY = 86_400_000;
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * intervalDays * MS_PER_DAY);
    dates.push(formatIso(d));
  }
  return dates; // ascending order
}

// ────────────────────────────────────────────
// Fake adapter
// ────────────────────────────────────────────

interface FakeAdapter {
  scheduleCount: number;
  cancelCount: number;
  schedule(id: string, fireDate: Date, title: string, body: string): Promise<void>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
}

function createFakeAdapter(): FakeAdapter {
  return {
    scheduleCount: 0,
    cancelCount: 0,
    async schedule() { this.scheduleCount++; },
    async cancel() { this.cancelCount++; },
    async cancelAll() { this.scheduleCount = 0; },
  };
}

// ────────────────────────────────────────────
// Main (dynamic imports after shim is in place)
// ────────────────────────────────────────────

async function main(): Promise<void> {
  const { memoryRepo } = await import("../src/db/memoryRepo");
  const { reconcileOnLaunch } = await import("../src/domain/reconcileOnLaunch");
  const { exportData } = await import("../src/domain/exportData");
  const { importData } = await import("../src/domain/importData");
  const { syncNotifications } = await import("../src/domain/syncNotifications");
  const { deleteProfileAndReassignActive } = await import("../src/domain/profileLifecycle");
  const { saveActiveProfileId } = await import("../src/domain/AppState");

  const repo = memoryRepo;
  const report: Array<[string, string]> = [];

  // ── Seed ──
  const { ms: seedMs } = await measure("seed", async () => {
    await repo.clearAllForTesting();
    storage["flowcycle.trackedNotificationIds"] = "[]";

    for (let p = 0; p < PROFILES_COUNT; p++) {
      const profile = await repo.createProfile(`Profile-${p + 1}`);
      const daysBefore = p % 4; // vary 0..3
      await repo.setNotificationPreference(profile.id, true, daysBefore);

      const dates = generateCycleDates(CYCLES_PER_PROFILE, ANCHOR_DATE, CYCLE_INTERVAL_DAYS);
      for (const d of dates) {
        await repo.addCycleStart(profile.id, d);
      }
    }

    // Set active to highest id, then delete it to exercise reassignment
    const profiles = await repo.listProfiles();
    const highest = profiles.reduce((a, b) => (a.id > b.id ? a : b));
    await saveActiveProfileId(highest.id);
    const adapter = createFakeAdapter();
    await deleteProfileAndReassignActive(repo, adapter, highest.id);
  });
  report.push(["Seed (5 profiles × 120 cycles, delete+reassign)", `${seedMs.toFixed(2)} ms`]);

  const profilesAfter = await repo.listProfiles();
  const totalCycles = await Promise.all(
    profilesAfter.map((p) => repo.listCycleStarts(p.id).then((cs) => cs.length)),
  );
  report.push(["Dataset", `${profilesAfter.length} profiles, ${totalCycles.reduce((a, b) => a + b, 0)} cycle starts`]);

  // ── reconcileOnLaunch ──
  const adapter1 = createFakeAdapter();
  const { ms: reconcileMs } = await measure("reconcileOnLaunch", async () => {
    await reconcileOnLaunch(repo, adapter1);
  });
  report.push(["reconcileOnLaunch", `${reconcileMs.toFixed(2)} ms`]);

  // ── exportData ──
  let exportBundle: unknown;
  const { ms: exportMs } = await measure("exportData", async () => {
    exportBundle = await exportData(repo, APP_VERSION);
  });
  report.push(["exportData", `${exportMs.toFixed(2)} ms`]);

  // ── JSON.stringify ──
  let json = "";
  const { ms: stringifyMs } = await measure("JSON.stringify", async () => {
    json = JSON.stringify(exportBundle, null, 2);
  });
  const jsonBytes = Buffer.byteLength(json, "utf-8");
  report.push(["JSON.stringify", `${stringifyMs.toFixed(2)} ms`]);
  report.push(["Export JSON size", `${jsonBytes.toLocaleString()} bytes (${(jsonBytes / 1024).toFixed(1)} KB)`]);

  // ── importData (overwrite into fresh state) ──
  const adapter2 = createFakeAdapter();
  const { ms: importMs } = await measure("importData", async () => {
    await importData(repo, adapter2, exportBundle);
  });
  report.push(["importData (strict overwrite)", `${importMs.toFixed(2)} ms`]);

  // ── syncNotifications (standalone) ──
  const adapter3 = createFakeAdapter();
  const { ms: syncMs } = await measure("syncNotifications", async () => {
    await syncNotifications(repo, adapter3);
  });
  report.push(["syncNotifications (standalone)", `${syncMs.toFixed(2)} ms`]);
  report.push(["  → scheduled", `${adapter3.scheduleCount}`]);
  report.push(["  → cancelled", `${adapter3.cancelCount}`]);

  // ── Report ──
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     FlowCycle Stress Baseline Report         ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const labelWidth = Math.max(...report.map(([l]) => l.length)) + 2;
  for (const [label, value] of report) {
    console.log(`  ${label.padEnd(labelWidth)} ${value}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Stress baseline failed:", err);
  process.exit(1);
});
