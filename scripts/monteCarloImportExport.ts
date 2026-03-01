/**
 * DEV-ONLY Monte Carlo import/export round-trip test.
 *
 * For N iterations, generates a random valid export bundle,
 * imports it into memoryRepo, re-exports, and asserts deep equality
 * of the profiles data.
 *
 * Run: npm run stress:montecarlo
 */

import { performance } from "node:perf_hooks";

// ── Shim window.localStorage for AsyncStorage ──
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

// ── Seeded PRNG (mulberry32) for reproducibility ──
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260301;
const rand = mulberry32(SEED);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ── Date helpers ──
const MS_PER_DAY = 86_400_000;
const ANCHOR = Date.UTC(2026, 1, 25); // 2026-02-25

function formatIso(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatIsoTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

// ── Bundle generator ──
type CycleStartEntry = { startDateIso: string; createdAt: string };
type ProfileEntry = {
  id: number;
  name: string;
  createdAt: string;
  cycleStarts: CycleStartEntry[];
  notificationPreference: { enabled: boolean; daysBefore: number } | null;
};

function generateBundle(profileCount: number, maxCyclesPerProfile: number): Record<string, unknown> {
  const profiles: ProfileEntry[] = [];
  let nextId = 1;

  for (let p = 0; p < profileCount; p++) {
    const id = nextId++;
    const cycleCount = randInt(0, maxCyclesPerProfile);
    const cycleStarts: CycleStartEntry[] = [];

    // Generate ascending dates going backwards from anchor
    let cursor = ANCHOR - cycleCount * 28 * MS_PER_DAY;
    for (let c = 0; c < cycleCount; c++) {
      const gap = randInt(24, 35); // realistic cycle length variance
      cursor += gap * MS_PER_DAY;
      if (cursor > ANCHOR) break; // don't exceed anchor
      cycleStarts.push({
        startDateIso: formatIso(cursor),
        createdAt: formatIsoTimestamp(cursor + randInt(0, 12) * 3_600_000),
      });
    }

    // Deduplicate (in case gap math lands on same date)
    const seen = new Set<string>();
    const dedupedCycleStarts = cycleStarts.filter((cs) => {
      if (seen.has(cs.startDateIso)) return false;
      seen.add(cs.startDateIso);
      return true;
    });

    let notificationPreference: ProfileEntry["notificationPreference"] = null;
    const prefRoll = rand();
    if (prefRoll < 0.4) {
      notificationPreference = { enabled: true, daysBefore: randInt(0, 7) };
    } else if (prefRoll < 0.7) {
      notificationPreference = { enabled: false, daysBefore: randInt(0, 7) };
    }
    // else null

    const createdAtMs = ANCHOR - (profileCount - p) * 30 * MS_PER_DAY;
    profiles.push({
      id,
      name: `Profile-${id}`,
      createdAt: formatIsoTimestamp(createdAtMs),
      cycleStarts: dedupedCycleStarts,
      notificationPreference,
    });
  }

  return {
    schemaVersion: 1,
    appVersion: "0.5.0-test",
    exportedAtIso: formatIsoTimestamp(ANCHOR),
    profiles,
  };
}

// ── Fake adapter ──
function createStubAdapter() {
  return {
    scheduleCount: 0,
    cancelCount: 0,
    async schedule() { this.scheduleCount++; },
    async cancel() { this.cancelCount++; },
    async cancelAll() {},
  };
}

// ── Main ──
const ITERATIONS = 200;

async function main(): Promise<void> {
  const { memoryRepo } = await import("../src/db/memoryRepo");
  const { exportData } = await import("../src/domain/exportData");
  const { importData } = await import("../src/domain/importData");

  const repo = memoryRepo;

  let maxProfiles = 0;
  let maxCycles = 0;
  let worstImportMs = 0;
  let worstExportMs = 0;
  let failures = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const profileCount = randInt(1, 10);
    const maxCyclesPerProfile = randInt(0, 150);

    const bundle = generateBundle(profileCount, maxCyclesPerProfile);
    const bundleProfiles = bundle.profiles as ProfileEntry[];
    const totalCycles = bundleProfiles.reduce((sum, p) => sum + p.cycleStarts.length, 0);

    maxProfiles = Math.max(maxProfiles, profileCount);
    maxCycles = Math.max(maxCycles, totalCycles);

    // Import
    await repo.clearAllForTesting();
    for (const k of Object.keys(storage)) delete storage[k];

    const adapter = createStubAdapter();
    const importStart = performance.now();
    await importData(repo, adapter, bundle);
    const importMs = performance.now() - importStart;
    worstImportMs = Math.max(worstImportMs, importMs);

    // Export
    const exportStart = performance.now();
    const exported = await exportData(repo, "0.5.0-test");
    const exportMs = performance.now() - exportStart;
    worstExportMs = Math.max(worstExportMs, exportMs);

    // JSON round-trip
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json);

    // Re-import from parsed
    await repo.clearAllForTesting();
    for (const k of Object.keys(storage)) delete storage[k];

    const adapter2 = createStubAdapter();
    await importData(repo, adapter2, parsed);

    const reExported = await exportData(repo, "0.5.0-test");

    // Assert profiles deep equality
    const originalProfiles = JSON.stringify(exported.profiles);
    const roundTripProfiles = JSON.stringify(reExported.profiles);

    if (originalProfiles !== roundTripProfiles) {
      failures++;
      console.error(`FAIL iteration ${i}: profiles mismatch`);
      console.error(`  profileCount=${profileCount} totalCycles=${totalCycles}`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     Monte Carlo Import/Export Report         ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(`  Seed                  ${SEED}`);
  console.log(`  Iterations            ${ITERATIONS}`);
  console.log(`  Failures              ${failures}`);
  console.log(`  Max profiles          ${maxProfiles}`);
  console.log(`  Max total cycles      ${maxCycles}`);
  console.log(`  Worst import (ms)     ${worstImportMs.toFixed(2)}`);
  console.log(`  Worst export (ms)     ${worstExportMs.toFixed(2)}`);
  console.log("");

  if (failures > 0) {
    console.error(`FAILED: ${failures}/${ITERATIONS} iterations had mismatches.`);
    process.exit(1);
  } else {
    console.log("  ALL PASSED");
    console.log("");
  }
}

main().catch((err) => {
  console.error("Monte Carlo failed:", err);
  process.exit(1);
});
