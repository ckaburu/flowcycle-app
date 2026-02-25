import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { ScreenContainer, AppText, AppButton } from "../ui";
import { colors, spacing } from "../ui/tokens";

type WelcomeScreenProps = {
  onNext: () => void;
};

export function WelcomeScreen({ onNext }: WelcomeScreenProps): ReactElement {
  return (
    <ScreenContainer scroll={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Feather
            name="circle"
            size={48}
            color={colors.primary}
            style={styles.logo}
          />
          <AppText variant="heading" style={styles.title}>
            FlowCycle
          </AppText>
          <AppText variant="body" style={styles.subtitle}>
            Your cycle, your device
          </AppText>
          <AppText variant="caption" style={styles.caption}>
            Private. Offline. Yours.
          </AppText>
        </View>
        <View style={styles.footer}>
          <AppButton title="Get Started" variant="primary" onPress={onNext} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  caption: {
    color: colors.textMuted,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.xl,
  },
});
