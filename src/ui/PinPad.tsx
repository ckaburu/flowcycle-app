import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "./AppText";
import { colors, spacing, radii } from "./tokens";

// ── Types ────────────────────────────────────────────────────────────

type PinPadProps = {
  pinLength: number;
  filledCount: number;
  onDigitPress: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  error?: boolean;
};

// ── Constants ────────────────────────────────────────────────────────

const DOT_SIZE = 14;
const KEY_SIZE = 64;
const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

// ── Component ────────────────────────────────────────────────────────

export function PinPad({
  pinLength,
  filledCount,
  onDigitPress,
  onBackspace,
  disabled = false,
  error = false,
}: PinPadProps): ReactElement {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;

    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [error, shakeAnim]);

  const dotColor = error ? colors.error : colors.primary;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Dot indicators */}
      <Animated.View
        style={[
          styles.dotsRow,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        {Array.from({ length: pinLength }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < filledCount
                ? { backgroundColor: dotColor }
                : { backgroundColor: colors.border },
            ]}
          />
        ))}
      </Animated.View>

      {/* Digit grid */}
      <View style={styles.grid}>
        {DIGITS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((label, colIndex) => {
              if (label === "") {
                return <View key={colIndex} style={styles.keyPlaceholder} />;
              }

              const isBackspace = label === "⌫";
              const onPress = isBackspace
                ? onBackspace
                : () => onDigitPress(label);

              return (
                <Pressable
                  key={colIndex}
                  onPress={onPress}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.key,
                    pressed && !disabled && styles.keyPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isBackspace ? "Delete last digit" : `Digit ${label}`
                  }
                >
                  <AppText
                    variant="subheading"
                    style={[
                      styles.keyLabel,
                      disabled && styles.keyLabelDisabled,
                    ]}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  dotsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.full,
  },
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: {
    backgroundColor: colors.border,
  },
  keyPlaceholder: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  keyLabel: {
    color: colors.text,
  },
  keyLabelDisabled: {
    color: colors.disabled,
  },
});
