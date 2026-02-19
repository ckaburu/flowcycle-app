import type { ReactElement } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "./AppText";
import { AVATAR_PALETTE, avatarColorIndex } from "./avatarColor";
import { colors } from "./tokens";

// ─── Props ──────────────────────────────────────────────────────────

type ProfileAvatarProps = {
  name: string;
  /** Diameter in dp. Default: 40. */
  size?: number;
  /** Called when avatar is pressed. Omit to disable press. */
  onPress?: () => void;
};

// ─── Component ──────────────────────────────────────────────────────

export function ProfileAvatar({
  name,
  size = 40,
  onPress,
}: ProfileAvatarProps): ReactElement {
  const bgColor = AVATAR_PALETTE[avatarColorIndex(name)];
  const initial = name.length > 0 ? name.charAt(0).toUpperCase() : "?";
  const fontSize = Math.round(size * 0.45);

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
  };

  const content = (
    <AppText
      variant="body"
      style={[
        styles.initial,
        { fontSize, lineHeight: Math.round(fontSize * 1.2) },
      ]}
    >
      {initial}
    </AppText>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name} avatar`}
        style={({ pressed }) => [
          styles.container,
          circleStyle,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`${name} avatar`}
      style={[styles.container, circleStyle]}
    >
      {content}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.primaryFg,
    fontWeight: "700",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
