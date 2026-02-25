import type { ReactElement } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppText } from "./AppText";
import { colors, spacing } from "./tokens";

type EmptyStateProps = {
  message: string;
  /** Optional secondary hint text. */
  hint?: string;
  /** Optional Feather icon name displayed above the message. */
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
};

export function EmptyState({ message, hint, icon, style }: EmptyStateProps): ReactElement {
  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <Feather name={icon} size={32} color={colors.textMuted} style={styles.icon} />
      ) : null}
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
  icon: {
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: "center",
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
