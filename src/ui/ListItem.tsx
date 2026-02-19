import type { ReactElement } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, spacing } from "./tokens";

type ListItemProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  testID?: string;
};

export function ListItem({
  label,
  value,
  onPress,
  showChevron,
  testID,
}: ListItemProps): ReactElement {
  const chevronVisible = showChevron ?? onPress !== undefined;

  const content = (
    <View style={styles.row} testID={testID}>
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.right}>
        {value !== undefined && (
          <AppText variant="body" style={styles.value}>
            {value}
          </AppText>
        )}
        {chevronVisible && (
          <AppText variant="body" style={styles.chevron}>
            ›
          </AppText>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    flex: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  value: {
    color: colors.textMuted,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
