/**
 * Pure logic for CycleDayRing progress calculation.
 * Extracted from the component for testability (ts-jest/node can't parse JSX).
 */

/**
 * Compute ring fill progress as a fraction in [0, 1].
 *
 * - null cycleDay or typicalLength → 0 (empty ring)
 * - cycleDay / typicalLength clamped to [0, 1]
 */
export function computeRingProgress(
  cycleDay: number | null,
  typicalLength: number | null,
): number {
  if (cycleDay === null || typicalLength === null || typicalLength <= 0) {
    return 0;
  }
  return Math.min(Math.max(cycleDay / typicalLength, 0), 1);
}

/**
 * Detect overflow: cycleDay exceeds typicalLength.
 * When true the ring should use `colors.warning` instead of `colors.primary`.
 */
export function isOverflow(
  cycleDay: number | null,
  typicalLength: number | null,
): boolean {
  if (cycleDay === null || typicalLength === null) {
    return false;
  }
  return cycleDay > typicalLength;
}
