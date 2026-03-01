/**
 * DEV-ONLY: generates a set of malformed import JSON files
 * for on-device verification testing.
 *
 * Run: npm run pack:malformed
 * Output: ./tmp/import-pack/
 */

import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

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

const OUTPUT_DIR = path.resolve("tmp/import-pack");

function writeFile(name: string, content: string): void {
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`  wrote ${name} (${Buffer.byteLength(content, "utf-8")} bytes)`);
}

async function main(): Promise<void> {
  const { memoryRepo } = await import("../src/db/memoryRepo");
  const { exportData } = await import("../src/domain/exportData");

  // ── Generate a valid baseline ──
  const repo = memoryRepo;
  await repo.clearAllForTesting();

  const profile = await repo.createProfile("TestUser");
  await repo.addCycleStart(profile.id, "2026-01-05");
  await repo.addCycleStart(profile.id, "2026-02-02");
  await repo.addCycleStart(profile.id, "2026-03-01");
  await repo.setNotificationPreference(profile.id, true, 2);

  const bundle = await exportData(repo, "0.5.0");
  const validJson = JSON.stringify(bundle, null, 2);

  // ── Clean output dir ──
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("\nGenerating malformed import pack...\n");

  // 1. Valid baseline
  writeFile("valid_baseline.json", validJson);

  // 2. bad_schema_v2.json — schemaVersion changed to 2
  const schemaBundle = JSON.parse(validJson);
  schemaBundle.schemaVersion = 2;
  writeFile("bad_schema_v2.json", JSON.stringify(schemaBundle, null, 2));

  // 3. bad_truncated.json — last 200 chars removed
  const truncated = validJson.slice(0, -200);
  writeFile("bad_truncated.json", truncated);

  // 4. bad_syntax.json — break a quote in name field
  const syntaxBroken = validJson.replace('"name": "TestUser"', '"name": TestUser"');
  writeFile("bad_syntax.json", syntaxBroken);

  // 5. bad_exported_at.json — invalid exportedAtIso
  const exportedAtBundle = JSON.parse(validJson);
  exportedAtBundle.exportedAtIso = "not-a-real-date";
  writeFile("bad_exported_at.json", JSON.stringify(exportedAtBundle, null, 2));

  // 6. bad_unsorted_cycles.json — swap first two cycle starts
  const unsortedBundle = JSON.parse(validJson);
  const cycles = unsortedBundle.profiles[0].cycleStarts;
  if (cycles.length >= 2) {
    [cycles[0], cycles[1]] = [cycles[1], cycles[0]];
  }
  writeFile("bad_unsorted_cycles.json", JSON.stringify(unsortedBundle, null, 2));

  // 7. bad_duplicate_ids.json — duplicate the profile with same id
  const dupBundle = JSON.parse(validJson);
  const original = dupBundle.profiles[0];
  const duplicate = { ...JSON.parse(JSON.stringify(original)), name: "DuplicateUser" };
  dupBundle.profiles.push(duplicate);
  writeFile("bad_duplicate_ids.json", JSON.stringify(dupBundle, null, 2));

  console.log(`\nDone. ${7} files written to ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("Pack generation failed:", err);
  process.exit(1);
});
