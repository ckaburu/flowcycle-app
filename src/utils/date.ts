const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function assertIsoDate(value: string): void {
  if (!isValidIsoDate(value)) {
    throw new Error(`Invalid ISO date: "${value}". Expected YYYY-MM-DD.`);
  }
}

/**
 * Convert a Date to "YYYY-MM-DD" using **local** timezone.
 * Use this for dates from the native date picker (which operates in local time).
 */
export function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse "YYYY-MM-DD" to a Date at local midnight.
 * Use this to provide an initial value to the native date picker.
 */
export function isoToLocalDate(iso: string): Date {
  assertIsoDate(iso);
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}
