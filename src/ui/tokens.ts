/**
 * Design tokens for FlowCycle.
 * Light theme only (dark mode deferred).
 * System fonts only — no custom font loading.
 */

// ─── Colors ──────────────────────────────────────────────────────────

export const colors = {
  primary: "#D4738C", // Dusty Rose
  primaryFg: "#FFFFFF", // White on primary
  secondary: "#8FB5A3", // Sage Green
  background: "#FAFAF8", // Warm White
  surface: "#FFFFFF", // Card / Sheet White
  text: "#2D2D2D", // Dark Slate
  textMuted: "#7A7A7A", // Gray
  error: "#C75450", // Muted Red
  errorBg: "#FDF0EF", // Light red tint for banners
  border: "#E5E5E3", // Light Gray
  accent: "#E8C87A", // Warm Gold (use sparingly)
  warning: "#E09640", // Amber/Orange (overflow indicator)
  disabled: "#BFBFBF", // Disabled elements
  disabledBg: "#F0F0EE", // Disabled button background
  success: "#6B9E78", // Muted Green — confirmation states
  successBg: "#EFF6F0", // Light green tint for banners
  info: "#6B8DAE", // Steel Blue — informational states
  infoBg: "#EEF3F7", // Light blue tint for banners
  destructive: "#C75450", // Alias of error — explicit semantic for delete/remove
  destructiveBg: "#FDF0EF", // Alias of errorBg — destructive action backgrounds
  surfaceMuted: "#F5F5F3", // Warm gray — neutral edit/selected tint
} as const;

// ─── Spacing (4px grid) ─────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screenH: 16, // Horizontal screen padding (alias of md)
  cardPad: 16, // Card internal padding (alias of md)
} as const;

// ─── Typography ─────────────────────────────────────────────────────

export type TypographyRole =
  | "heading"
  | "subheading"
  | "body"
  | "caption"
  | "label"
  | "number"
  | "numberSmall"
  | "sectionTitle";

export const typography: Record<
  TypographyRole,
  { fontSize: number; fontWeight: "400" | "500" | "600" | "700"; lineHeight: number }
> = {
  heading: { fontSize: 24, fontWeight: "700", lineHeight: 32 },
  subheading: { fontSize: 18, fontWeight: "600", lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  number: { fontSize: 32, fontWeight: "700", lineHeight: 40 },
  numberSmall: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
} as const;

// ─── Border Radii ───────────────────────────────────────────────────

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

// ─── Elevation / Shadows ────────────────────────────────────────────

export const elevation = {
  0: {},
  1: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2, // Android
  },
  2: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4, // Android
  },
} as const;
