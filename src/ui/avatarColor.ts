/**
 * Deterministic avatar color derivation.
 * Pure logic — no React dependencies.
 */

export const AVATAR_PALETTE = [
  "#D4738C", // dusty rose   — L 0.282, CR 3.17:1
  "#6A9C85", // sage green   — L 0.285, CR 3.13:1
  "#B88B20", // warm gold    — L 0.288, CR 3.11:1
  "#5699C8", // soft blue    — L 0.289, CR 3.09:1
  "#B37EC8", // lavender     — L 0.287, CR 3.12:1
  "#C78252", // warm tan     — L 0.287, CR 3.11:1
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
