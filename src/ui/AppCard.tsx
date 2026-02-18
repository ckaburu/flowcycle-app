import type { ReactElement, ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, elevation, radii, spacing } from "./tokens";

type AppCardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function AppCard({ children, style }: AppCardProps): ReactElement {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...elevation[1],
  },
});
