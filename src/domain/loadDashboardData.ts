/**
 * Pure data loader for the Dashboard. No React dependencies.
 * Fetches cycle starts for the given profile, computes cycle
 * metrics via cycleMath, and returns structured data.
 */

import type { Repository } from "../db/repo";
import {
  computeCycleDay,
  estimateNextStart,
  formatIsoDate,
  typicalCycleLength,
} from "./cycleMath";

// ─── Types ───────────────────────────────────────────────────────────

export type DashboardData = {
  profileName: string;
  profileId: number;
  cycleDay: number | null;
  typicalLength: number | null;
  lastStart: string | null;
  nextStartEstimate: string | null;
  sortedStartDates: string[];
};

// ─── Loader ──────────────────────────────────────────────────────────

/**
 * Load all dashboard data for the given profile.
 *
 * @param profileId - Active profile ID
 * @param repo - Repository instance (injected for testability)
 * @param todayIso - Optional today override for deterministic testing
 * @returns DashboardData
 * @throws Error if profile not found
 */
export async function loadDashboardData(
  profileId: number,
  repo: Repository,
  todayIso?: string,
): Promise<DashboardData> {
  // 1. Fetch profile
  const profiles = await repo.listProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  // 2. Fetch and sort cycle starts ascending
  const cycleStarts = await repo.listCycleStarts(profileId);
  const sortedStartDates = cycleStarts
    .map((cs) => cs.startDateIso)
    .sort();

  // 3. Determine today
  const today = todayIso ?? formatIsoDate(new Date());

  // 4. Compute metrics
  const lastStart =
    sortedStartDates.length > 0
      ? sortedStartDates[sortedStartDates.length - 1]
      : null;

  const cycleDay =
    lastStart !== null ? computeCycleDay(today, lastStart) : null;

  const typLen = typicalCycleLength(sortedStartDates);

  const nextStartEstimate =
    lastStart !== null && typLen !== null
      ? estimateNextStart(lastStart, typLen)
      : null;

  return {
    profileName: profile.name,
    profileId: profile.id,
    cycleDay,
    typicalLength: typLen,
    lastStart,
    nextStartEstimate,
    sortedStartDates,
  };
}
