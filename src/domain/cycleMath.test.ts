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

    it("returns null with 2 cycle starts (only 1 interval, below minimum of 2)", () => {
      expect(typicalCycleLength(["2026-01-01", "2026-01-30"])).toBeNull();
    });

    it("returns median of 2 intervals with 3 cycle starts", () => {
      // 3 starts → 2 intervals: 29 (Jan 1→Jan 30), 29 (Jan 30→Feb 28) → median = 29
      expect(typicalCycleLength(["2026-01-01", "2026-01-30", "2026-02-28"])).toBe(29);
    });

    it("sorts internally — unsorted input produces same result", () => {
      expect(typicalCycleLength(["2026-02-28", "2026-01-01", "2026-01-30"])).toBe(29);
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

  describe("prediction transitions by start count", () => {
    it("0 starts → null", () => {
      expect(typicalCycleLength([])).toBeNull();
    });

    it("1 start → null", () => {
      expect(typicalCycleLength(["2026-01-01"])).toBeNull();
    });

    it("2 starts → null (1 interval below minimum)", () => {
      expect(typicalCycleLength(["2026-01-01", "2026-01-29"])).toBeNull();
    });

    it("3 starts → median of 2 intervals", () => {
      // intervals: 28, 28 → median = 28
      expect(typicalCycleLength(["2026-01-01", "2026-01-29", "2026-02-26"])).toBe(28);
    });

    it("4 starts → median of last 3 intervals", () => {
      // intervals: 28, 28, 30 → median = 28
      expect(typicalCycleLength(["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-28"])).toBe(28);
    });
  });

  describe("historical edit retroactive prediction", () => {
    it("editing a historical entry changes typicalCycleLength", () => {
      // Original: Jan 1, Jan 29, Feb 26, Mar 26
      // intervals: 28, 28, 28 → typical = 28
      const original = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"];
      expect(typicalCycleLength(original)).toBe(28);

      // Edit Jan 29 → Feb 10 (simulates user correcting a historical entry)
      // intervals: 40, 16, 28 → typical = median([40, 16, 28]) = 28
      const edited = ["2026-01-01", "2026-02-10", "2026-02-26", "2026-03-26"];
      expect(typicalCycleLength(edited)).toBe(28);

      // Edit Jan 29 → Feb 20 (more extreme)
      // intervals: 50, 6, 28 → typical = median([50, 6, 28]) = 28
      const edited2 = ["2026-01-01", "2026-02-20", "2026-02-26", "2026-03-26"];
      expect(typicalCycleLength(edited2)).toBe(28);
    });

    it("editing majority of entries can shift the median", () => {
      // intervals: 28, 28, 28 → typical = 28
      const original = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"];
      expect(typicalCycleLength(original)).toBe(28);

      // Edit so 2 of 3 intervals become 35
      // intervals: 35, 35, 28 → typical = median([35, 35, 28]) = 35
      const edited = ["2026-01-01", "2026-02-05", "2026-03-12", "2026-04-09"];
      expect(typicalCycleLength(edited)).toBe(35);
    });
  });

  describe("estimateNextStart", () => {
    it("returns YYYY-MM-DD formatted next start", () => {
      expect(estimateNextStart("2026-01-31", 29)).toBe("2026-03-01");
    });
  });
});
