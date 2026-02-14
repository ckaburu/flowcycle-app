import {
  computeCycleDay,
  estimateNextStart,
  median,
  typicalCycleLength,
} from "./cycleMath";

describe("cycleMath", () => {
  describe("computeCycleDay", () => {
    it("returns 1 when today is cycle start day", () => {
      expect(computeCycleDay("2026-03-10", "2026-03-10")).toBe(1);
    });

    it("increments by full days since last cycle start", () => {
      expect(computeCycleDay("2026-03-11", "2026-03-10")).toBe(2);
      expect(computeCycleDay("2026-03-20", "2026-03-10")).toBe(11);
    });
  });

  describe("typicalCycleLength", () => {
    it("returns null with 0 or 1 cycle starts", () => {
      expect(typicalCycleLength([])).toBeNull();
      expect(typicalCycleLength(["2026-01-01"])).toBeNull();
    });

    it("returns one length with 2 cycle starts", () => {
      expect(typicalCycleLength(["2026-01-01", "2026-01-30"])).toBe(29);
    });

    it("returns median from available lengths with 3 cycle starts", () => {
      expect(typicalCycleLength(["2026-01-01", "2026-01-30", "2026-02-28"])).toBe(29);
    });

    it("uses only last up to maxN lengths for 3+ cycles", () => {
      expect(
        typicalCycleLength(
          ["2026-01-01", "2026-01-31", "2026-03-02", "2026-04-05", "2026-05-06"],
          3
        )
      ).toBe(31);
    });
  });

  describe("median", () => {
    it("computes odd and even medians", () => {
      expect(median([3, 1, 2])).toBe(2);
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe("estimateNextStart", () => {
    it("returns YYYY-MM-DD formatted next start", () => {
      expect(estimateNextStart("2026-01-31", 29)).toBe("2026-03-01");
    });
  });
});
