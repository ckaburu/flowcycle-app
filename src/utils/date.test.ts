import {
  isValidIsoDate,
  assertIsoDate,
  localDateToIso,
  isoToLocalDate,
} from "./date";

describe("isValidIsoDate", () => {
  it("accepts valid dates", () => {
    expect(isValidIsoDate("2026-02-25")).toBe(true);
    expect(isValidIsoDate("2000-01-01")).toBe(true);
    expect(isValidIsoDate("2024-12-31")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects invalid dates", () => {
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false); // month 13
    expect(isValidIsoDate("2026-02-30")).toBe(false); // Feb 30
    expect(isValidIsoDate("2023-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("2026/02/25")).toBe(false);
  });
});

describe("assertIsoDate", () => {
  it("does not throw for valid dates", () => {
    expect(() => assertIsoDate("2026-02-25")).not.toThrow();
  });

  it("throws for invalid dates", () => {
    expect(() => assertIsoDate("bad")).toThrow("Invalid ISO date");
  });
});

describe("localDateToIso", () => {
  it("formats a local date to YYYY-MM-DD", () => {
    const date = new Date(2026, 1, 25); // Feb 25, 2026 local
    expect(localDateToIso(date)).toBe("2026-02-25");
  });

  it("zero-pads single-digit month and day", () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(localDateToIso(date)).toBe("2026-01-05");
  });

  it("handles December 31", () => {
    const date = new Date(2025, 11, 31); // Dec 31, 2025
    expect(localDateToIso(date)).toBe("2025-12-31");
  });

  it("handles January 1", () => {
    const date = new Date(2026, 0, 1); // Jan 1, 2026
    expect(localDateToIso(date)).toBe("2026-01-01");
  });
});

describe("isoToLocalDate", () => {
  it("parses YYYY-MM-DD to local midnight", () => {
    const date = isoToLocalDate("2026-02-25");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed
    expect(date.getDate()).toBe(25);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("throws for invalid date strings", () => {
    expect(() => isoToLocalDate("bad")).toThrow("Invalid ISO date");
    expect(() => isoToLocalDate("2026-13-01")).toThrow();
  });
});

describe("localDateToIso / isoToLocalDate round-trip", () => {
  it("round-trips from string", () => {
    const iso = "2026-06-15";
    expect(localDateToIso(isoToLocalDate(iso))).toBe(iso);
  });

  it("round-trips from Date", () => {
    const date = new Date(2026, 5, 15); // Jun 15
    const result = isoToLocalDate(localDateToIso(date));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it("round-trips edge case: leap day", () => {
    const iso = "2024-02-29";
    expect(localDateToIso(isoToLocalDate(iso))).toBe(iso);
  });
});
