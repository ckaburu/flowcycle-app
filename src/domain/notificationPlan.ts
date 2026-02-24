import {
  typicalCycleLength,
  estimateNextStart,
  parseIsoDate,
  formatIsoDate,
} from "./cycleMath";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type ReminderItem = {
  /** Deterministic ID: `fc-remind-{profileId}-{fireDateIso}T{HH:mm}` */
  id: string;
  profileId: number;
  profileName: string;
  /** ISO date of the predicted period start */
  targetDateIso: string;
  /** ISO date when the reminder should fire (targetDate − daysBefore) */
  fireDateIso: string;
  /** How many days before period start */
  daysBefore: number;
  title: string;
  body: string;
};

export type NotificationPlan = {
  /** Items that should be newly scheduled (excludes already-scheduled) */
  toSchedule: ReminderItem[];
  /** Deterministic IDs of previously-scheduled items no longer valid */
  toCancel: string[];
};

export type ProfileNotificationInput = {
  profileId: number;
  profileName: string;
  enabled: boolean;
  daysBefore: number;
  cycleStartDates: string[];
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function makeReminderId(
  profileId: number,
  fireDateIso: string,
  fireTimeHHmm: string = "09:00",
): string {
  return `fc-remind-${profileId}-${fireDateIso}T${fireTimeHHmm}`;
}

function subtractDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  const result = new Date(date.getTime() - days * MS_PER_DAY);
  return formatIsoDate(result);
}

// ────────────────────────────────────────────
// Functions
// ────────────────────────────────────────────

/**
 * Build ALL future reminder items for a single profile.
 *
 * Returns an array of N reminders (one per predicted future cycle start),
 * ordered chronologically. Returns empty array if insufficient cycle data
 * or all fire dates are in the past.
 *
 * Pure function — no side effects, no date/time dependency (todayIso passed in).
 */
export function buildNotificationPlan(
  profileId: number,
  profileName: string,
  daysBefore: number,
  cycleStartDates: string[],
  todayIso: string,
  maxReminders: number,
): ReminderItem[] {
  const typLen = typicalCycleLength(cycleStartDates);
  if (typLen === null) {
    return [];
  }

  const items: ReminderItem[] = [];
  let lastStartIso = cycleStartDates.reduce((a, b) => (a > b ? a : b));

  for (let i = 0; i < maxReminders; i++) {
    const targetDateIso = estimateNextStart(lastStartIso, typLen);
    const fireDateIso = subtractDays(targetDateIso, daysBefore);

    // Only include if fire date is today or in the future
    if (fireDateIso >= todayIso) {
      items.push({
        id: makeReminderId(profileId, fireDateIso),
        profileId,
        profileName,
        targetDateIso,
        fireDateIso,
        daysBefore,
        title: "Period Reminder",
        body: `${profileName}'s period may start in ${daysBefore} day(s)`,
      });
    }

    // Advance to next predicted cycle regardless of inclusion
    lastStartIso = targetDateIso;
  }

  return items;
}

/**
 * Given ALL profiles with their cycle data and notification prefs,
 * compute the full plan: what to schedule and what to cancel.
 *
 * Compares desired reminders against existingIds to produce minimal
 * toSchedule (new only) and toCancel (stale only) sets.
 *
 * Pure function — deterministic for same inputs.
 */
export function computeNotificationPlan(
  profiles: ProfileNotificationInput[],
  existingIds: string[],
  todayIso: string,
  maxRemindersPerProfile: number,
): NotificationPlan {
  const desiredItems: ReminderItem[] = [];

  for (const profile of profiles) {
    if (!profile.enabled) {
      continue;
    }

    const items = buildNotificationPlan(
      profile.profileId,
      profile.profileName,
      profile.daysBefore,
      profile.cycleStartDates,
      todayIso,
      maxRemindersPerProfile,
    );
    desiredItems.push(...items);
  }

  const desiredIds = new Set(desiredItems.map((item) => item.id));
  const existingSet = new Set(existingIds);

  // New items: desired but not already scheduled
  const toSchedule = desiredItems.filter((item) => !existingSet.has(item.id));

  // Stale items: previously scheduled but no longer desired
  const toCancel = existingIds.filter((id) => !desiredIds.has(id));

  return { toSchedule, toCancel };
}

// ────────────────────────────────────────────
// DEV-only test helpers
// ────────────────────────────────────────────

/**
 * Deterministic ID for test notifications.
 * Includes seconds to avoid collisions in rapid-fire testing.
 * Format: fc-test-{profileId}-{YYYY-MM-DD}T{HH:mm:ss}
 */
export function makeTestReminderId(
  profileId: number,
  fireDate: Date,
): string {
  const iso = formatIsoDate(fireDate);
  const hh = String(fireDate.getHours()).padStart(2, "0");
  const mm = String(fireDate.getMinutes()).padStart(2, "0");
  const ss = String(fireDate.getSeconds()).padStart(2, "0");
  return `fc-test-${profileId}-${iso}T${hh}:${mm}:${ss}`;
}

/**
 * Build a single ReminderItem that fires now + delaySeconds.
 * Pure function — pass `now` for deterministic testing.
 */
export function buildTestReminder(
  profileId: number,
  profileName: string,
  delaySeconds: number,
  now: Date = new Date(),
): ReminderItem {
  const fireDate = new Date(now.getTime() + delaySeconds * 1000);
  const fireDateIso = formatIsoDate(fireDate);
  return {
    id: makeTestReminderId(profileId, fireDate),
    profileId,
    profileName,
    targetDateIso: fireDateIso,
    fireDateIso,
    daysBefore: 0,
    title: "FlowCycle Test",
    body: `Test reminder for ${profileName} (${delaySeconds}s delay)`,
  };
}
