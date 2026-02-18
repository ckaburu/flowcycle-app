import { useState, type ReactElement } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";

import { AppText } from "./AppText";
import { colors, radii, spacing, typography } from "./tokens";

type AppInputProps = TextInputProps & {
  /** Label displayed above the input. */
  label?: string;
  /** Error message displayed below the input. */
  errorText?: string;
};

export function AppInput({
  label,
  errorText,
  style,
  ...rest
}: AppInputProps): ReactElement {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = errorText
    ? colors.error
    : isFocused
      ? colors.primary
      : colors.border;

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          styles.input,
          { borderColor },
          style,
        ]}
        onFocus={(e) => {
          setIsFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          rest.onBlur?.(e);
        }}
      />
      {errorText ? (
        <AppText variant="caption" color={colors.error} style={styles.error}>
          {errorText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  error: {
    marginTop: spacing.xs,
  },
});
