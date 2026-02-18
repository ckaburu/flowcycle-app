import type { ReactElement } from "react";
import { Text, TextProps, StyleSheet } from "react-native";

import { colors, typography, TypographyRole } from "./tokens";

type AppTextProps = TextProps & {
  /** Typography role — defaults to "body". */
  variant?: TypographyRole;
  /** Override color (defaults to text for most, textMuted for caption). */
  color?: string;
};

export function AppText({
  variant = "body",
  color,
  style,
  ...rest
}: AppTextProps): ReactElement {
  const typo = typography[variant];
  const defaultColor = variant === "caption" ? colors.textMuted : colors.text;

  return (
    <Text
      style={[
        styles.base,
        {
          fontSize: typo.fontSize,
          fontWeight: typo.fontWeight,
          lineHeight: typo.lineHeight,
          color: color ?? defaultColor,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // System font by default — no fontFamily needed
  },
});
