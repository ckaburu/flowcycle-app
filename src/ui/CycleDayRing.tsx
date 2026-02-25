import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, typography } from "./tokens";
import { computeRingProgress, isOverflow } from "./cycleDayRingLogic";

// ─── Props ───────────────────────────────────────────────────────────

type CycleDayRingProps = {
  /** Current cycle day, 1-based. Null if no data. */
  cycleDay: number | null;
  /** Typical cycle length for progress calculation. Null if unknown. */
  typicalLength: number | null;
  /** Outer diameter in dp. Default: 180. */
  size?: number;
};

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_SIZE = 200;
const RING_THICKNESS = 8;

// ─── Component ───────────────────────────────────────────────────────

/**
 * Circular progress indicator showing current cycle day.
 * Built entirely with View + border styling (no SVG).
 *
 * Two-semicircle rotation technique:
 * - Right half mask clips 0–50% progress
 * - Left half mask clips 50–100% progress
 */
export function CycleDayRing({
  cycleDay,
  typicalLength,
  size = DEFAULT_SIZE,
}: CycleDayRingProps): ReactElement {
  const progress = computeRingProgress(cycleDay, typicalLength);
  const overflow = isOverflow(cycleDay, typicalLength);
  const fillColor = overflow ? colors.warning : colors.primary;

  // Convert progress (0–1) to degrees (0–360)
  const degrees = progress * 360;

  const half = size / 2;
  const innerSize = size - RING_THICKNESS * 2;

  // Right semicircle covers 0–180° (progress 0–50%)
  const rightRotation = Math.min(degrees, 180);
  // Left semicircle covers 180–360° (progress 50–100%)
  const leftRotation = Math.max(degrees - 180, 0);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: RING_THICKNESS,
          borderColor: colors.border,
        },
      ]}
    >
      {/* ── Right half mask (0–50% progress) ── */}
      <View
        style={[
          styles.halfMask,
          {
            width: half,
            height: size,
            left: half,
            borderTopRightRadius: half,
            borderBottomRightRadius: half,
          },
        ]}
      >
        <View
          style={[
            styles.halfFill,
            {
              width: half,
              height: size,
              borderTopRightRadius: half,
              borderBottomRightRadius: half,
              borderWidth: RING_THICKNESS,
              borderLeftWidth: 0,
              borderColor: fillColor,
              transform: [
                { translateX: -half / 2 },
                { rotate: `${rightRotation}deg` },
                { translateX: half / 2 },
              ],
            },
          ]}
        />
      </View>

      {/* ── Left half mask (50–100% progress) ── */}
      <View
        style={[
          styles.halfMask,
          {
            width: half,
            height: size,
            left: 0,
            borderTopLeftRadius: half,
            borderBottomLeftRadius: half,
          },
        ]}
      >
        <View
          style={[
            styles.halfFill,
            {
              width: half,
              height: size,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
              borderWidth: RING_THICKNESS,
              borderRightWidth: 0,
              borderColor: fillColor,
              transform: [
                { translateX: half / 2 },
                { rotate: `${leftRotation}deg` },
                { translateX: -half / 2 },
              ],
            },
          ]}
        />
      </View>

      {/* ── Center content ── */}
      <View
        style={[
          styles.center,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        <AppText variant="caption" style={styles.dayLabel}>
          Day
        </AppText>
        <AppText
          variant="number"
          style={[
            styles.dayNumber,
            { color: cycleDay !== null ? colors.primary : colors.textMuted },
          ]}
        >
          {cycleDay !== null ? String(cycleDay) : "—"}
        </AppText>
        {cycleDay !== null && typicalLength !== null ? (
          <AppText variant="caption" style={styles.caption}>
            of {typicalLength}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  halfMask: {
    position: "absolute",
    top: -RING_THICKNESS,
    overflow: "hidden",
  },
  halfFill: {
    position: "absolute",
    top: 0,
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dayNumber: {
    fontSize: typography.number.fontSize,
    fontWeight: typography.number.fontWeight,
    lineHeight: typography.number.lineHeight,
  },
  dayLabel: {
    color: colors.textMuted,
    marginBottom: -2,
  },
  caption: {
    color: colors.textMuted,
  },
});
