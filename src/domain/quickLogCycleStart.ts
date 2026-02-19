import type { Repository, CycleStart } from "../db/repo";

export type QuickLogResult =
  | { status: "created"; cycleStart: CycleStart }
  | { status: "already_exists" };

/**
 * Idempotent quick-log: if a cycle start already exists for the given
 * date, returns { status: "already_exists" } without creating a duplicate.
 * Otherwise creates the cycle start and returns { status: "created", cycleStart }.
 *
 * @param profileId - Active profile ID
 * @param dateIso - ISO date string (YYYY-MM-DD)
 * @param repo - Repository instance (injected for testability)
 */
export async function quickLogCycleStart(
  profileId: number,
  dateIso: string,
  repo: Repository,
): Promise<QuickLogResult> {
  // 1. Fetch existing cycle starts for this profile
  const existing = await repo.listCycleStarts(profileId);
  // 2. Check if dateIso already exists
  const alreadyExists = existing.some((cs) => cs.startDateIso === dateIso);
  if (alreadyExists) {
    return { status: "already_exists" };
  }
  // 3. Create new cycle start
  const cycleStart = await repo.addCycleStart(profileId, dateIso);
  return { status: "created", cycleStart };
}
