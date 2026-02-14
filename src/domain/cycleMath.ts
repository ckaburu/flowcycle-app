import { assertIsoDate } from "../utils/date";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseIsoDate(iso: string): Date {
  assertIsoDate(iso);
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysBetween(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bUtc - aUtc) / MS_PER_DAY);
}

export function computeCycleDay(todayIso: string, lastStartIso: string): number {
  const today = parseIsoDate(todayIso);
  const lastStart = parseIsoDate(lastStartIso);
  return Math.max(1, daysBetween(lastStart, today) + 1);
}

export function computeCycleLengths(sortedStartDatesIsoAsc: string[]): number[] {
  const lengths: number[] = [];

  for (let index = 1; index < sortedStartDatesIsoAsc.length; index += 1) {
    const previous = parseIsoDate(sortedStartDatesIsoAsc[index - 1]);
    const current = parseIsoDate(sortedStartDatesIsoAsc[index]);
    const diff = daysBetween(previous, current);
    if (diff > 0) {
      lengths.push(diff);
    }
  }

  return lengths;
}

export function median(nums: number[]): number {
  if (nums.length === 0) {
    throw new Error("Cannot compute median of an empty array.");
  }

  const sorted = [...nums].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function typicalCycleLength(startDatesIsoAsc: string[], maxN = 3): number | null {
  if (maxN <= 0) {
    return null;
  }

  const lengths = computeCycleLengths(startDatesIsoAsc);
  if (lengths.length === 0) {
    return null;
  }

  const recent = lengths.slice(-Math.min(maxN, lengths.length));
  return median(recent);
}

export function estimateNextStart(lastStartIso: string, typicalLen: number): string {
  if (!Number.isFinite(typicalLen)) {
    throw new Error("typicalLen must be a finite number.");
  }

  const roundedLength = Math.round(typicalLen);
  if (roundedLength <= 0) {
    throw new Error("typicalLen must be greater than zero.");
  }

  const lastStart = parseIsoDate(lastStartIso);
  const nextStart = new Date(lastStart.getTime() + roundedLength * MS_PER_DAY);
  return formatIsoDate(nextStart);
}
