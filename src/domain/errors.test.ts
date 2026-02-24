import {
  DuplicateCycleStartError,
  FutureDateError,
  assertNotFutureDate,
} from "./errors";

describe("DuplicateCycleStartError", () => {
  it("has correct name and message", () => {
    const err = new DuplicateCycleStartError("2026-02-15");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DuplicateCycleStartError);
    expect(err.name).toBe("DuplicateCycleStartError");
    expect(err.message).toBe("A cycle start already exists for 2026-02-15.");
  });
});

describe("FutureDateError", () => {
  it("has correct name and message", () => {
    const err = new FutureDateError("2099-01-01");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FutureDateError);
    expect(err.name).toBe("FutureDateError");
    expect(err.message).toBe("Cycle start date 2099-01-01 is in the future.");
  });
});

describe("assertNotFutureDate", () => {
  it("allows today", () => {
    expect(() => assertNotFutureDate("2026-02-24", "2026-02-24")).not.toThrow();
  });

  it("allows past dates", () => {
    expect(() => assertNotFutureDate("2026-01-01", "2026-02-24")).not.toThrow();
  });

  it("throws FutureDateError for tomorrow", () => {
    expect(() => assertNotFutureDate("2026-02-25", "2026-02-24")).toThrow(FutureDateError);
  });

  it("throws FutureDateError for far future", () => {
    expect(() => assertNotFutureDate("2099-01-01", "2026-02-24")).toThrow(FutureDateError);
  });
});
