import type { ReactElement } from "react";
import { ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";

import { colors, spacing } from "./tokens";

type LoadingIndicatorProps = {
  /** Fill parent and center, or inline. Default: true (full). */
  fullScreen?: boolean;
  style?: ViewStyle;
};

export function LoadingIndicator({
  fullScreen = true,
  style,
}: LoadingIndicatorProps): ReactElement {
  return (
    <View style={[fullScreen ? styles.full : styles.inline, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  inline: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
