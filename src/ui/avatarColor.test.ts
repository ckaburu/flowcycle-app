import { avatarColorIndex, AVATAR_PALETTE } from "./avatarColor";

describe("avatarColorIndex", () => {
  it("returns the same index for the same name (deterministic)", () => {
    const idx1 = avatarColorIndex("Alice");
    const idx2 = avatarColorIndex("Alice");
    expect(idx1).toBe(idx2);
  });

  it("returns an index in range [0, palette.length - 1]", () => {
    const names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace"];
    for (const name of names) {
      const idx = avatarColorIndex(name);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(AVATAR_PALETTE.length);
    }
  });

  it("produces different indices for at least some different names", () => {
    const names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"];
    const indices = new Set(names.map(avatarColorIndex));
    // With 6 names over 6 palette slots, at least 2 different indices
    expect(indices.size).toBeGreaterThanOrEqual(2);
  });

  it("handles empty string without crashing", () => {
    const idx = avatarColorIndex("");
    expect(idx).toBe(0); // hash of empty = 0, 0 % 6 = 0
  });

  it("handles single character names", () => {
    const idx = avatarColorIndex("A");
    expect(typeof idx).toBe("number");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(AVATAR_PALETTE.length);
  });
});
