export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

export class DuplicateCycleStartError extends Error {
  constructor(startDateIso: string) {
    super(`A cycle start already exists for ${startDateIso}.`);
    this.name = "DuplicateCycleStartError";
  }
}

export class FutureDateError extends Error {
  constructor(startDateIso: string) {
    super(`Cycle start date ${startDateIso} is in the future.`);
    this.name = "FutureDateError";
  }
}

function localTodayIso(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function assertNotFutureDate(startDateIso: string, todayIso?: string): void {
  const today = todayIso ?? localTodayIso();
  if (startDateIso > today) {
    throw new FutureDateError(startDateIso);
  }
}
