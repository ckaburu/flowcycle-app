/**
 * Deterministic avatar color derivation.
 * Pure logic — no React dependencies.
 */

export const AVATAR_PALETTE = [
  "#D4738C", // dusty rose
  "#8FB5A3", // sage green
  "#E8C87A", // warm gold
  "#7BAFD4", // soft blue
  "#C49BD4", // lavender
  "#D4A07B", // warm tan
] as const;

/**
 * Deterministic hash → palette index.
 * Same name always produces the same color.
 */
export function avatarColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_PALETTE.length;
}
