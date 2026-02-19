import type { ReactElement } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, spacing } from "./tokens";

type SectionHeaderProps = {
  title: string;
  style?: ViewStyle;
};

export function SectionHeader({ title, style }: SectionHeaderProps): ReactElement {
  return (
    <View style={[styles.container, style]}>
      <AppText variant="caption" style={styles.title}>
        {title.toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
