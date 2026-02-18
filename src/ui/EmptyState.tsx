import type { ReactElement } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { AppText } from "./AppText";
import { colors, spacing } from "./tokens";

type EmptyStateProps = {
  message: string;
  /** Optional secondary hint text. */
  hint?: string;
  style?: ViewStyle;
};

export function EmptyState({ message, hint, style }: EmptyStateProps): ReactElement {
  return (
    <View style={[styles.container, style]}>
      <AppText variant="body" color={colors.textMuted} style={styles.message}>
        {message}
      </AppText>
      {hint ? (
        <AppText variant="caption" color={colors.textMuted} style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  message: {
    textAlign: "center",
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
