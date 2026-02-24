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
  startDates: string[];
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

  // 2. Fetch cycle start dates
  const cycleStarts = await repo.listCycleStarts(profileId);
  const startDates = cycleStarts.map((cs) => cs.startDateIso);

  // 3. Determine today
  const today = todayIso ?? formatIsoDate(new Date());

  // 4. Compute metrics
  const lastStart =
    startDates.length > 0
      ? startDates.reduce((a, b) => (a > b ? a : b))
      : null;

  const cycleDay =
    lastStart !== null ? computeCycleDay(today, lastStart) : null;

  const typLen = typicalCycleLength(startDates);

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
    startDates,
  };
}
