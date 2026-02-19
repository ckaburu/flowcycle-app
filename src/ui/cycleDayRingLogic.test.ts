import { computeRingProgress, isOverflow } from "./cycleDayRingLogic";

describe("computeRingProgress", () => {
  it("returns 0 when cycleDay is null", () => {
    expect(computeRingProgress(null, 28)).toBe(0);
  });

  it("returns 0 when typicalLength is null", () => {
    expect(computeRingProgress(5, null)).toBe(0);
  });

  it("returns 0 when both are null", () => {
    expect(computeRingProgress(null, null)).toBe(0);
  });

  it("returns 0 when typicalLength is 0", () => {
    expect(computeRingProgress(5, 0)).toBe(0);
  });

  it("returns 0 when typicalLength is negative", () => {
    expect(computeRingProgress(5, -1)).toBe(0);
  });

  it("returns 0.5 at midpoint", () => {
    expect(computeRingProgress(14, 28)).toBeCloseTo(0.5);
  });

  it("returns 1.0 at 100%", () => {
    expect(computeRingProgress(28, 28)).toBe(1);
  });

  it("clamps to 1.0 on overflow", () => {
    expect(computeRingProgress(35, 28)).toBe(1);
  });

  it("returns small fraction for day 1 of 28", () => {
    expect(computeRingProgress(1, 28)).toBeCloseTo(1 / 28);
  });
});

describe("isOverflow", () => {
  it("returns false when cycleDay is null", () => {
    expect(isOverflow(null, 28)).toBe(false);
  });

  it("returns false when typicalLength is null", () => {
    expect(isOverflow(5, null)).toBe(false);
  });

  it("returns false when cycleDay equals typicalLength", () => {
    expect(isOverflow(28, 28)).toBe(false);
  });

  it("returns false when cycleDay < typicalLength", () => {
    expect(isOverflow(14, 28)).toBe(false);
  });

  it("returns true when cycleDay > typicalLength", () => {
    expect(isOverflow(35, 28)).toBe(true);
  });

  it("returns true when exceeding by 1", () => {
    expect(isOverflow(29, 28)).toBe(true);
  });
});
