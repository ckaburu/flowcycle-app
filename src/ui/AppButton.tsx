import type { ReactElement } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, ViewStyle } from "react-native";

import { AppText } from "./AppText";
import { colors, radii, spacing, typography } from "./tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

const variantStyles: Record<
  ButtonVariant,
  { bg: string; bgPressed: string; fg: string; borderColor?: string }
> = {
  primary: {
    bg: colors.primary,
    bgPressed: "#C0607A",
    fg: colors.primaryFg,
  },
  secondary: {
    bg: colors.surface,
    bgPressed: colors.border,
    fg: colors.text,
    borderColor: colors.border,
  },
  ghost: {
    bg: "transparent",
    bgPressed: colors.disabledBg,
    fg: colors.primary,
  },
  danger: {
    bg: colors.error,
    bgPressed: "#A8423F",
    fg: colors.primaryFg,
  },
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: AppButtonProps): ReactElement {
  const vs = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={
        Platform.OS === "android" ? { color: vs.bgPressed } : undefined
      }
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? colors.disabledBg
            : pressed
              ? vs.bgPressed
              : vs.bg,
          borderColor: isDisabled
            ? colors.disabled
            : vs.borderColor ?? "transparent",
          borderWidth: vs.borderColor ? 1 : 0,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isDisabled ? colors.disabled : vs.fg}
        />
      ) : (
        <AppText
          variant="label"
          color={isDisabled ? colors.disabled : vs.fg}
          style={styles.text}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 2, // 10px — slightly more than sm for touch target
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44, // minimum touch target
  },
  text: {
    fontSize: typography.label.fontSize,
    textAlign: "center",
  },
});
